"use client";

import { useState, useEffect } from "react";
import { X, Loader2, AlertCircle, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

interface CompareSession {
  id: string;
  query: string;
  location: string;
  status: string;
  startedAt: number;
  completedAt: number | null;
  duration: number | null;
  yield: { leads: number; emails: number; phones: number; enriched: number };
  statusBreakdown: { verified: number; needs_enrich: number; pending: number; failed: number };
}

// The delta indicator only makes a directional claim (up/down/flat) between
// these two specific sessions, never a broader "better" or "worse" judgment
// since a smaller radius search legitimately finds fewer leads without that
// meaning anything went wrong.
function Delta({ a, b }: { a: number; b: number }) {
  if (a === b) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (b > a) return <ArrowUp className="h-3 w-3 text-positive" />;
  return <ArrowDown className="h-3 w-3 text-destructive" />;
}

const METRIC_ROWS: Array<{ label: string; get: (s: CompareSession) => number }> = [
  { label: "Total leads", get: (s) => s.yield.leads },
  { label: "Verified emails", get: (s) => s.yield.emails },
  { label: "Phone numbers", get: (s) => s.yield.phones },
  { label: "Enrichment attempts", get: (s) => s.yield.enriched },
];

const STATUS_ROWS: Array<{ label: string; key: keyof CompareSession["statusBreakdown"] }> = [
  { label: "Verified", key: "verified" },
  { label: "Needs enrichment", key: "needs_enrich" },
  { label: "Pending", key: "pending" },
  { label: "Failed", key: "failed" },
];

export function SessionCompareModal({ ids, onClose }: { ids: [string, string]; onClose: () => void }) {
  const [sessions, setSessions] = useState<CompareSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEscapeToClose(onClose);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/history/compare?ids=${encodeURIComponent(ids.join(","))}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          // API returns sessions in the order the ids were requested, but
          // guard against that assumption drifting silently by re-sorting
          // to match ids[] explicitly rather than trusting response order.
          const byId = new Map(data.sessions.map((s: CompareSession) => [s.id, s]));
          setSessions(ids.map((id) => byId.get(id)).filter(Boolean) as CompareSession[]);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load comparison");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">Compare sessions</h2>
          <button onClick={onClose} aria-label="Close comparison" className="rounded p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : error || !sessions || sessions.length !== 2 ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error || "Couldn't load both sessions."}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {sessions.map((s) => (
                <div key={s.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="truncate font-medium text-foreground">{s.query}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.location}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(s.startedAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-normal">Metric</th>
                  <th className="pb-2 font-normal">Session A</th>
                  <th className="w-6 pb-2"></th>
                  <th className="pb-2 font-normal">Session B</th>
                </tr>
              </thead>
              <tbody>
                {METRIC_ROWS.map((row) => {
                  const a = row.get(sessions[0]);
                  const b = row.get(sessions[1]);
                  return (
                    <tr key={row.label} className="border-b border-border/50">
                      <td className="py-2 text-muted-foreground">{row.label}</td>
                      <td className="py-2 font-mono text-foreground">{a}</td>
                      <td className="py-2">
                        <Delta a={a} b={b} />
                      </td>
                      <td className="py-2 font-mono text-foreground">{b}</td>
                    </tr>
                  );
                })}
                {STATUS_ROWS.map((row) => {
                  const a = sessions[0].statusBreakdown[row.key];
                  const b = sessions[1].statusBreakdown[row.key];
                  return (
                    <tr key={row.key} className="border-b border-border/50">
                      <td className="py-2 pl-3 text-xs text-muted-foreground">{row.label}</td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">{a}</td>
                      <td className="py-2">
                        <Delta a={a} b={b} />
                      </td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">{b}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
