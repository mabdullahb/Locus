"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, History, ExternalLink } from "lucide-react";
import { useHistoryStore } from "@/stores/history-store";
import { useExtractionStore } from "@/stores/extraction-store";
import { HistoryCard } from "./history-card";

export function HistoryPanel() {
  const router = useRouter();
  const sessions = useHistoryStore((s) => s.sessions);
  const isPanelOpen = useHistoryStore((s) => s.isPanelOpen);
  const closePanel = useHistoryStore((s) => s.closePanel);
  const addSession = useHistoryStore((s) => s.addSession);
  const updateSession = useHistoryStore((s) => s.updateSession);

  const extractionStatus = useExtractionStore((s) => s.status);
  const locationsFound = useExtractionStore((s) => s.locationsFound);
  const phonesExtracted = useExtractionStore((s) => s.phonesExtracted);
  const emailsVerified = useExtractionStore((s) => s.emailsVerified);
  const fullyEnriched = useExtractionStore((s) => s.fullyEnriched);
  const config = useExtractionStore((s) => s.config);
  const errorMessage = useExtractionStore((s) => s.errorMessage);

  const liveSessionId = useRef<string | null>(null);

  useEffect(() => {
    if (extractionStatus === "running" && !liveSessionId.current) {
      const id = `hist-live-${Date.now()}`;
      liveSessionId.current = id;
      addSession({
        id,
        query: "Live Extraction",
        location: "Current",
        status: "running",
        yield: { leads: 0, emails: 0, phones: 0, enriched: 0 },
        config: {
          keyword: "Live Extraction",
          location: "Current",
          radius: "10",
          concurrency: 4,
          proxyType: "datacenter",
          enrichmentDepth: config?.enrichmentDepth ?? "standard",
          maxResults: config?.maxResults ?? 100,
          locale: "en-IN",
          renderDelay: 500,
        },
        startedAt: Date.now(),
        completedAt: null,
        duration: null,
        errorLog: null,
      });
    }
  }, [extractionStatus, config?.enrichmentDepth, config?.maxResults, addSession]);

  useEffect(() => {
    if (!liveSessionId.current) return;
    updateSession(liveSessionId.current, {
      yield: {
        leads: locationsFound,
        emails: emailsVerified,
        phones: phonesExtracted,
        enriched: fullyEnriched,
      },
    });
  }, [locationsFound, phonesExtracted, emailsVerified, fullyEnriched, updateSession]);

  useEffect(() => {
    const id = liveSessionId.current;
    if (!id) return;

    if (extractionStatus === "complete") {
      updateSession(id, {
        status: "completed",
        completedAt: Date.now(),
        duration: Math.round((Date.now() - (sessions.find((s) => s.id === id)?.startedAt ?? Date.now())) / 1000),
      });
      liveSessionId.current = null;
    } else if (extractionStatus === "error") {
      updateSession(id, {
        status: "failed",
        completedAt: Date.now(),
        duration: Math.round((Date.now() - (sessions.find((s) => s.id === id)?.startedAt ?? Date.now())) / 1000),
        errorLog: errorMessage,
      });
      liveSessionId.current = null;
    } else if (extractionStatus === "aborted") {
      updateSession(id, {
        status: "aborted",
        completedAt: Date.now(),
        duration: Math.round((Date.now() - (sessions.find((s) => s.id === id)?.startedAt ?? Date.now())) / 1000),
        errorLog: "User aborted the extraction.",
      });
      liveSessionId.current = null;
    }
  }, [extractionStatus, errorMessage, sessions, updateSession]);

  useEffect(() => {
    if (extractionStatus === "idle") {
      liveSessionId.current = null;
    }
  }, [extractionStatus]);

  const handleReRun = () => {
    closePanel();
    router.push("/dashboard");
  };

  const handleViewDetails = () => {
    closePanel();
    router.push("/history");
  };

  return (
    <>
      {isPanelOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
          onClick={closePanel}
        />
      )}

      <div
        className={`fixed right-0 top-0 z-40 flex h-full w-80 flex-col border-l border-border bg-card shadow-xl transition-transform duration-300 ${
          isPanelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-semibold text-foreground">
              History
            </h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {sessions.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                closePanel();
                router.push("/history");
              }}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              Full View
            </button>
            <button
              onClick={closePanel}
              className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No sessions yet</p>
              <p className="text-xs text-muted-foreground/60">
                Start an extraction to see it here
              </p>
            </div>
          ) : (
            sessions.map((session) => (
              <HistoryCard
                key={session.id}
                session={session}
                onReRun={handleReRun}
                onViewDetails={handleViewDetails}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
