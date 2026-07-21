"use client";

import { useState } from "react";
import { XCircle, AlertTriangle } from "lucide-react";
import { useExtractionStore } from "@/stores/extraction-store";

export function AbortMissionButton() {
  const [confirming, setConfirming] = useState(false);
  const abort = useExtractionStore((s) => s.abortExtraction);

  const handleAbort = () => {
    abort();
    setConfirming(false);
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-red-500">
          <AlertTriangle className="h-3 w-3" />
          Partial results will be saved
        </span>
        <button
          onClick={handleAbort}
          className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
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
      className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/20"
    >
      <XCircle className="h-3.5 w-3.5" />
      Abort Mission
    </button>
  );
}
