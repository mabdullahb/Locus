"use client";

import { useState } from "react";
import { XCircle, AlertTriangle } from "lucide-react";
import { useExtractionStore } from "@/stores/extraction-store";

export function AbortMissionButton() {
  const [confirming, setConfirming] = useState(false);
  const abort = useExtractionStore((s) => s.abortExtraction);
  const sessionId = useExtractionStore((s) => s.sessionId);

  const handleAbort = () => {
    abort();
    setConfirming(false);
    if (sessionId) {
      fetch(`/api/scrape/${sessionId}/cancel`, { method: "POST" }).catch(() => {});
    }
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" />
          Partial results will be saved
        </span>
        <button
          onClick={handleAbort}
          className="rounded-lg bg-destructive-solid px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive-solid/90"
        >
          Confirm Abort
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Keep Running
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
    >
      <XCircle className="h-3.5 w-3.5" />
      Abort Mission
    </button>
  );
}
