"use client";

import { create } from "zustand";
import { useLeadsStore } from "./leads-store";

const API_BASE = "/api";

export type PipelineStage =
  | "idle"
  | "initializing"
  | "navigating"
  | "parsing"
  | "enriching"
  | "formatting"
  | "complete"
  | "error"
  | "aborted";

export type ExtractionStatus = "idle" | "running" | "complete" | "error" | "aborted";

interface ExtractionConfig {
  keyword: string;
  location: string;
  enrichmentDepth: string;
  radius?: string;
  locale?: string;
}

interface ExtractionState {
  status: ExtractionStatus;
  stage: PipelineStage;
  progress: number;
  locationsFound: number;
  phonesExtracted: number;
  emailsVerified: number;
  fullyEnriched: number;
  errorMessage: string | null;
  config: ExtractionConfig | null;
  sessionId: string | null;
  // Whether the search provider has more results beyond the current batch —
  // drives whether the "Load 100 more" button is shown.
  hasMore: boolean;
  loadingMore: boolean;

  startExtraction: (config: ExtractionConfig) => void;
  loadMore: () => Promise<void>;
  abortExtraction: () => void;
  dismissComplete: () => void;
  setStage: (stage: string, progress: number, metrics: Record<string, number>) => void;
  updateMetrics: (metrics: Record<string, number>) => void;
  setComplete: (totalYield: number, finalMetrics?: Record<string, number> & { hasMore?: boolean }) => void;
  setError: (message: string) => void;
  hydrateResumable: (session: {
    id: string;
    totalYield: number;
    phonesExtracted: number;
    emailsVerified: number;
    fullyEnriched: number;
  }) => void;
}

export const useExtractionStore = create<ExtractionState>((set, get) => ({
  status: "idle",
  stage: "idle",
  progress: 0,
  locationsFound: 0,
  phonesExtracted: 0,
  emailsVerified: 0,
  fullyEnriched: 0,
  errorMessage: null,
  config: null,
  sessionId: null,
  hasMore: false,
  loadingMore: false,

  // Every "stage"/"metrics" broadcast from the server carries the current
  // absolute totals (e.g. locationsFound is always results.length, the same
  // value on every enrichment-loop tick), not a delta since the last message.
  // Adding them here instead of replacing multiplied the displayed counts by
  // however many enrichment ticks had fired (100 -> 4,900 after 48 ticks).
  setStage: (stage, progress, metrics) => {
    set((s) => ({
      stage: stage as PipelineStage,
      progress,
      status: "running" as ExtractionStatus,
      locationsFound: metrics.locationsFound ?? s.locationsFound,
      phonesExtracted: metrics.phonesExtracted ?? s.phonesExtracted,
      emailsVerified: metrics.emailsVerified ?? s.emailsVerified,
      fullyEnriched: metrics.fullyEnriched ?? s.fullyEnriched,
    }));
  },

  updateMetrics: (metrics) => {
    set((s) => ({
      locationsFound: metrics.locationsFound ?? s.locationsFound,
      phonesExtracted: metrics.phonesExtracted ?? s.phonesExtracted,
      emailsVerified: metrics.emailsVerified ?? s.emailsVerified,
      fullyEnriched: metrics.fullyEnriched ?? s.fullyEnriched,
      progress: metrics.progress ?? s.progress,
    }));
  },

  // The "complete" broadcast carries final counts computed fresh from the DB
  // (server/index.ts) — apply them as the authoritative last word, so any
  // drift during the run can't leave stale numbers on screen at 100%.
  setComplete: (totalYield, finalMetrics) => {
    set({
      status: "complete",
      stage: "complete",
      progress: 100,
      loadingMore: false,
      hasMore: finalMetrics?.hasMore ?? false,
      locationsFound: finalMetrics?.locationsFound ?? totalYield,
      phonesExtracted: finalMetrics?.phonesExtracted ?? get().phonesExtracted,
      emailsVerified: finalMetrics?.emailsVerified ?? get().emailsVerified,
      fullyEnriched: finalMetrics?.fullyEnriched ?? get().fullyEnriched,
    });
  },

  setError: (message) => {
    // A "Load 100 more" continuation sets loadingMore: true and then waits
    // on a WebSocket broadcast. Success arrives as "complete" (which
    // setComplete resets), but a failure arrives as "error", which only
    // ever landed here. Leaving loadingMore stuck at true meant the button
    // never recovered. Not just for this attempt (its whole block only
    // renders for status "complete", so it just vanished), but for every
    // later successful extraction too, since nothing else in the store
    // ever reset it back to false. The button would reappear already
    // permanently disabled.
    set({ status: "error", stage: "error", errorMessage: message, loadingMore: false });
  },

  // Only called on Dashboard mount when the store is still idle (nothing
  // running or already loaded this session in) — never overwrites a live
  // extraction the user is actively watching.
  hydrateResumable: (session) => {
    set({
      status: "complete",
      stage: "complete",
      progress: 100,
      sessionId: session.id,
      hasMore: true,
      loadingMore: false,
      errorMessage: null,
      locationsFound: session.totalYield,
      phonesExtracted: session.phonesExtracted,
      emailsVerified: session.emailsVerified,
      fullyEnriched: session.fullyEnriched,
    });
  },

  startExtraction: async (config) => {
    useLeadsStore.getState().replaceLeads([]);
    set({
      status: "running",
      stage: "initializing",
      progress: 0,
      locationsFound: 0,
      phonesExtracted: 0,
      emailsVerified: 0,
      fullyEnriched: 0,
      errorMessage: null,
      hasMore: false,
      loadingMore: false,
      config,
    });

    try {
      const res = await fetch(`${API_BASE}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: config.keyword,
          location: config.location,
          enrichmentDepth: config.enrichmentDepth,
          radius: config.radius,
          locale: config.locale,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.sessionId) {
          set({ sessionId: data.sessionId });
          return;
        }
      } else {
        // Surface the server's actual reason (plan limit reached, no API
        // key configured, etc.) instead of a generic fallback that hides
        // what's really blocking the user.
        set({
          status: "error",
          stage: "error",
          progress: 0,
          errorMessage: data.error || "Failed to start extraction — please try again.",
        });
        return;
      }
    } catch {
      // Backend unreachable (network error, not an API-level rejection)
    }

    set({
      status: "error",
      stage: "error",
      progress: 0,
      errorMessage: "Extraction service unavailable — please try again later.",
    });
  },

  // Fetches the next fixed-size batch (100) of results for the SAME session
  // — same query, same provider, continuing from where the last batch left
  // off. The existing WebSocket connection (keyed by sessionId, which doesn't
  // change here) keeps delivering "stage"/"complete" broadcasts for it.
  loadMore: async () => {
    const sessionId = get().sessionId;
    if (!sessionId || get().loadingMore) return;

    set({ loadingMore: true, status: "running", stage: "parsing", errorMessage: null });

    try {
      const res = await fetch(`${API_BASE}/scrape/${sessionId}/more`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        set({
          loadingMore: false,
          status: "complete",
          stage: "complete",
          errorMessage: body.error || "Failed to load more results",
        });
      }
      // On success, wait for the WebSocket "stage"/"complete" broadcasts —
      // same handling path as the initial run.
    } catch {
      set({
        loadingMore: false,
        status: "complete",
        stage: "complete",
        errorMessage: "Failed to load more results",
      });
    }
  },

  abortExtraction: () => {
    set({
      status: "aborted",
      stage: "aborted",
      progress: get().progress,
    });
  },

  dismissComplete: () => {
    useLeadsStore.getState().replaceLeads([]);
    set({ status: "idle", stage: "idle", progress: 0, sessionId: null, hasMore: false, loadingMore: false });
  },

}));
