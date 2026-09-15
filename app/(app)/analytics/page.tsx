"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionSummary {
  id: string;
  query: string;
  totalYield: number;
  status: string;
  startedAt: string;
  duration: number | null;
}

interface AnalyticsData {
  totalExtractions: number;
  totalLeadsFound: number;
  totalEmailsVerified: number;
  totalEnrichmentRuns: number;
  recentSessions: SessionSummary[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/trends");
      if (!res.ok) throw new Error("Failed to load analytics");
      setData(await res.json());
    } catch {
      setError("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchData();
    });
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.01em] text-foreground-strong">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your extraction and enrichment usage over time.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading analytics...
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs text-muted-foreground">Extractions Run</p>
              <p className="mt-1 font-mono text-[24px] font-medium tracking-[-0.01em] tabular-nums text-foreground-strong">
                {data.totalExtractions}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs text-muted-foreground">Leads Found</p>
              <p className="mt-1 font-mono text-[24px] font-medium tracking-[-0.01em] tabular-nums text-foreground-strong">
                {data.totalLeadsFound}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs text-muted-foreground">Emails Verified</p>
              <p className="mt-1 font-mono text-[24px] font-medium tracking-[-0.01em] tabular-nums text-foreground-strong">
                {data.totalEmailsVerified}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs text-muted-foreground">Enrichment Runs</p>
              <p className="mt-1 font-mono text-[24px] font-medium tracking-[-0.01em] tabular-nums text-foreground-strong">
                {data.totalEnrichmentRuns}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 font-display text-base font-semibold text-foreground">
              Recent Extraction Sessions
            </h2>
            {data.recentSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No extraction sessions yet.</p>
            ) : (
              <div className="space-y-2">
                {data.recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {session.query}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.startedAt).toLocaleDateString()}
                        {session.duration ? ` · ${session.duration}s` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <span className="text-sm text-muted-foreground">
                        {session.totalYield} leads
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          session.status === "completed"
                            ? "bg-positive/10 text-positive"
                            : session.status === "running"
                              ? "bg-primary/10 text-primary"
                              : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {session.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
