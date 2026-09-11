"use client";

import { useEffect, useRef } from "react";
import { useExtractionStore } from "@/stores/extraction-store";
import { useLeadsStore, type Lead } from "@/stores/leads-store";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/ws";
// The WebSocket has no reconnect logic. If it drops for any reason (worker
// restart, network blip, laptop sleep, a proxy timing out an idle
// connection), the UI just freezes on whatever stage it last showed,
// forever, even though the job may have long since finished server-side.
// This poll is the safety net: while the store still thinks an extraction
// is "running", periodically ask the DB directly whether that's still true,
// and correct the UI if reality has moved on.
const RECONCILE_INTERVAL_MS = 8000;

interface RawWebSocketLead {
  id?: string;
  businessName?: string;
  title?: string;
  location?: string;
  address?: string;
  phone?: string;
  email?: string;
  status?: string;
}

function mapLeads(raw: RawWebSocketLead[], sessionId: string): Lead[] {
  // A lead without a real DB id can't be opened ("View" 404s against
  // /api/leads/[id]), surface that loudly instead of minting a synthetic
  // id that silently produces an unopenable row. That fallback previously
  // masked a real server bug (server/index.ts's "complete" broadcast query
  // wasn't selecting id at all).
  return raw
    .filter((item): item is RawWebSocketLead & { id: string } => {
      if (!item.id) {
        console.error("WebSocket lead payload missing id, dropping row instead of faking one:", item);
        return false;
      }
      return true;
    })
    .map((item) => ({
      id: item.id,
      sessionId,
      businessName: item.businessName || item.title || "",
      location: item.location || item.address || "",
      phone: item.phone || "",
      email: item.email || "",
      // Was hardcoded to "pending" regardless of the lead's real status,
      // by the time the "complete" broadcast fires, enrichment has already
      // run and the DB status is verified/needs_enrich/failed, but the
      // table showed every lead stuck on "Pending" until a full reload
      // (server/index.ts's finalLeads query does select the real status).
      status: (item.status as Lead["status"]) || "pending",
      createdAt: Date.now(),
    }));
}

export function useScrapeWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const ws = new WebSocket(`${WS_URL}?sessionId=${sessionId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const { event: type, data } = JSON.parse(event.data);
        const store = useExtractionStore.getState();

        switch (type) {
          case "stage":
            store.setStage(data.stage, data.progress, data.metrics || {});
            break;
          case "metrics":
            store.updateMetrics(data.metrics);
            break;
          case "complete":
            store.setComplete(data.totalYield || 0, {
              locationsFound: data.totalYield,
              phonesExtracted: data.phonesExtracted,
              emailsVerified: data.emailsVerified,
              fullyEnriched: data.fullyEnriched,
              hasMore: data.hasMore,
            });
            useLeadsStore.getState().addLeads(mapLeads(data.leads || [], sessionId));
            break;
          case "lead-updated":
            // Per-lead status push as each one finishes enrichment during a
            // bulk run — this is what makes the table update live instead
            // of everything sitting on "Pending" until the user navigates
            // away and back (which was really just a fresh /api/leads fetch
            // picking up what the WebSocket never pushed).
            useLeadsStore.getState().updateLead(data.id, {
              status: data.status,
              ...(data.email ? { email: data.email } : {}),
            });
            break;
          case "error":
            store.setError(data.message);
            break;
          case "aborted":
            // Confirms the cancellation the user already triggered
            // optimistically (AbortMissionButton calls abortExtraction()
            // directly on click) — this is the server's authoritative
            // follow-up once the worker actually stops, not a fresh event.
            store.abortExtraction();
            break;
        }
      } catch {
        // ignore malformed messages
      }
    };

    let missingTicks = 0;
    // The worker's own job queue processes one scrape job at a time
    // (server/index.ts's Worker has no concurrency option set, BullMQ
    // defaults to 1), and the session row for a given job is only created
    // once the worker actually starts that job, not when it's enqueued. A
    // second real user (or the same user in a second tab) starting an
    // extraction while another is already running can legitimately sit
    // queued for as long as that other job takes, several minutes for a
    // large one, confirmed live: a 49-lead run took over 5 minutes, during
    // which a job queued behind it correctly had no session row yet. The
    // old 3-tick (24s) grace period treated that completely normal wait as
    // "the worker may have crashed." Matching the server's own stale-job
    // sweep (STALE_RUNNING_MS in server/index.ts, 15 minutes) as the real
    // authority on "this job is actually lost" rather than guessing on the
    // client with a much shorter, falsely-triggering window.
    const MISSING_SESSION_TIMEOUT_MS = 15 * 60 * 1000;
    const MAX_MISSING_TICKS = Math.ceil(MISSING_SESSION_TIMEOUT_MS / RECONCILE_INTERVAL_MS);

    const reconcile = async () => {
      if (useExtractionStore.getState().status !== "running") return;
      try {
        const res = await fetch(`/api/history/${sessionId}`);
        if (res.status === 404) {
          // A session id we ourselves just issued should always eventually
          // exist, once the worker actually starts this job (it may be
          // queued behind another one first, see above). Past the timeout,
          // nothing else recovers from a lost job, and the WebSocket has no
          // reconnect logic either, so silently returning here left the UI
          // frozen on "Starting Extraction" forever with zero explanation.
          missingTicks += 1;
          if (missingTicks >= MAX_MISSING_TICKS) {
            useExtractionStore.getState().setError(
              "Extraction never started (the background worker may have crashed). Please retry.",
            );
          }
          return;
        }
        if (!res.ok) return;
        missingTicks = 0;
        const session = await res.json();
        const store = useExtractionStore.getState();

        if (session.status === "completed") {
          const leadsRes = await fetch("/api/leads?page=1&pageSize=5000");
          const leadsBody = await leadsRes.json().catch(() => ({}));
          if (leadsBody.leads) useLeadsStore.getState().replaceLeads(leadsBody.leads);
          store.setComplete(session.yield.leads, {
            locationsFound: session.yield.leads,
            phonesExtracted: session.yield.phones,
            emailsVerified: session.yield.emails,
            fullyEnriched: session.yield.enriched,
          });
        } else if (session.status === "failed") {
          store.setError(session.errorLog || "Extraction failed");
        } else if (session.status === "aborted") {
          store.abortExtraction();
        }
      } catch {
        // Transient network error. The next tick tries again.
      }
    };

    const reconcileTimer = setInterval(reconcile, RECONCILE_INTERVAL_MS);

    return () => {
      clearInterval(reconcileTimer);
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId]);
}
