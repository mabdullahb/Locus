"use client";

import { useState, useRef } from "react";
import { X, Upload, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { parseBulkSearchCsv, MAX_BULK_SEARCH_ROWS, type BulkSearchRow } from "@/lib/bulk-search-csv";

// Deliberately doesn't try to show live per-row progress the way a single
// search does. The extraction store only tracks one running session's
// WebSocket feed at a time, building N-way live tracking is a bigger
// change than "queue several searches" calls for. Each row becomes a real
// session that shows up in History as it completes, same as running the
// same search manually N times, just queued instead of babysat.
const STAGGER_MS = 400;

type Phase = "pick" | "preview" | "queueing" | "done";

export function BulkSearchModal({ radius, onClose }: { radius: string; onClose: () => void }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [rows, setRows] = useState<BulkSearchRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [queuedCount, setQueuedCount] = useState(0);
  const [rowErrors, setRowErrors] = useState<string[]>([]);

  useEscapeToClose(onClose);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const result = parseBulkSearchCsv(text);
    setRows(result.rows);
    setParseErrors(result.errors);
    setPhase("preview");
  };

  const handleConfirm = async () => {
    setPhase("queueing");
    setQueuedCount(0);
    const failures: string[] = [];

    for (const row of rows) {
      try {
        const res = await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: row.query,
            location: row.location,
            radius: row.radius || radius,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          failures.push(`"${row.query}" in "${row.location}": ${body.error || `HTTP ${res.status}`}`);
        } else {
          setQueuedCount((n) => n + 1);
        }
      } catch {
        failures.push(`"${row.query}" in "${row.location}": network error`);
      }
      // A small stagger between requests, not a burst of N at once, gentler
      // on the worker queue and less likely to look like abuse to whichever
      // search provider's API is on the other end.
      await new Promise((r) => setTimeout(r, STAGGER_MS));
    }

    setRowErrors(failures);
    setPhase("done");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={phase === "queueing" ? undefined : onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">Bulk search</h2>
          {phase !== "queueing" && (
            <button onClick={onClose} aria-label="Close bulk search" className="rounded p-1 text-muted-foreground hover:bg-muted">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {phase === "pick" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV with a <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">query</code> column
              and a <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">location</code> column (an
              optional third <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">radius</code> column
              overrides the current radius per row). Each row queues as its own search, up to{" "}
              {MAX_BULK_SEARCH_ROWS} per upload.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background px-6 py-10 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              <Upload className="h-6 w-6" />
              Click to choose a CSV file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {phase === "preview" && (
          <div className="space-y-4">
            {parseErrors.length > 0 && (
              <div className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-xs text-destructive">
                {parseErrors.map((e, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{e}</span>
                  </div>
                ))}
              </div>
            )}

            {rows.length > 0 ? (
              <>
                <p className="text-sm text-foreground">
                  Ready to queue <strong>{rows.length}</strong> search{rows.length === 1 ? "" : "es"}:
                </p>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border bg-background p-2">
                  {rows.map((r, i) => (
                    <div key={i} className="rounded px-2 py-1.5 text-xs text-muted-foreground">
                      <span className="text-foreground">{r.query}</span> in {r.location}
                      {r.radius && <span className="text-muted-foreground"> ({r.radius} km)</span>}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setPhase("pick")}
                    className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                  >
                    Choose a different file
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Queue {rows.length} search{rows.length === 1 ? "" : "es"}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex justify-end">
                <button
                  onClick={() => setPhase("pick")}
                  className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  Choose a different file
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "queueing" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Queueing {queuedCount} of {rows.length}...
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-positive/40 bg-positive/10 px-4 py-3 text-sm text-positive">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Queued {queuedCount} of {rows.length} searches. Follow them in History as they complete.
            </div>
            {rowErrors.length > 0 && (
              <div className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-xs text-destructive">
                <p className="font-medium">{rowErrors.length} row{rowErrors.length === 1 ? "" : "s"} failed to queue:</p>
                {rowErrors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Close
              </button>
              <button
                onClick={() => router.push("/history")}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Go to History
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
