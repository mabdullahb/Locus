"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, RefreshCw, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface EnrichmentStats {
  totalEnriched: number;
  successfulEnrichments: number;
  successRate: number;
  methodBreakdown: Record<string, number>;
  failedLeads: Array<{
    id: string;
    businessName: string;
    location: string;
    status: string;
    errorMessage: string | null;
    isRateLimited: boolean;
  }>;
  rateLimitedCount: number;
  pendingCount: number;
}

interface RetryResult {
  attempted: number;
  verified: number;
  needsEnrich: number;
  stillFailed: number;
  remaining: number;
}

export default function EnrichmentPage() {
  const [stats, setStats] = useState<EnrichmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<"all" | "rate_limited" | null>(null);
  const [retryResult, setRetryResult] = useState<RetryResult | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/enrichment/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      setStats(await res.json());
    } catch {
      setError("Failed to load enrichment stats");
    } finally {
      setLoading(false);
    }
  };

  const retryFailed = async (scope: "all" | "rate_limited") => {
    setRetrying(scope);
    setRetryResult(null);
    setError(null);
    try {
      const res = await fetch("/api/enrichment/retry-failed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      if (!res.ok) throw new Error("Retry failed");
      setRetryResult(await res.json());
      await fetchStats();
    } catch {
      setError("Failed to retry enrichment. Check your AI provider key in Settings.");
    } finally {
      setRetrying(null);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchStats();
    });
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.01em] text-foreground-strong">AI Enrichment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor email enrichment performance and retry failed leads.
          </p>
        </div>
        <button
          onClick={fetchStats}
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

      {loading && !stats ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading enrichment stats...
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs text-muted-foreground">Enrichment Attempts</p>
              <p className="mt-1 font-mono text-[24px] font-medium tracking-[-0.01em] tabular-nums text-foreground-strong">
                {stats.totalEnriched}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs text-muted-foreground">Emails Found</p>
              <p className="mt-1 font-mono text-[24px] font-medium tracking-[-0.01em] tabular-nums text-foreground-strong">
                {stats.successfulEnrichments}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs text-muted-foreground">Success Rate</p>
              <p className="mt-1 font-mono text-[24px] font-medium tracking-[-0.01em] tabular-nums text-foreground-strong">
                {stats.successRate}%
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 font-display text-base font-semibold text-foreground">
              Method Breakdown
            </h2>
            {Object.keys(stats.methodBreakdown).length === 0 ? (
              <p className="text-sm text-muted-foreground">No enrichment data yet.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(stats.methodBreakdown).map(([method, count]) => {
                  const total = stats.totalEnriched || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={method}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground capitalize">{method}</span>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-foreground">
                Failed Enrichments
              </h2>
              {(stats.failedLeads.length > 0 || stats.pendingCount > 0) && (
                <div className="flex items-center gap-2">
                  {stats.rateLimitedCount > 0 && (
                    <button
                      onClick={() => retryFailed("rate_limited")}
                      disabled={retrying !== null}
                      className="flex h-8 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      {retrying === "rate_limited" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Retry Rate-Limited ({stats.rateLimitedCount})
                    </button>
                  )}
                  <button
                    onClick={() => retryFailed("all")}
                    disabled={retrying !== null}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {retrying === "all" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    Retry Failed &amp; Pending
                  </button>
                </div>
              )}
            </div>

            {stats.pendingCount > 0 && (
              <div className="mb-4 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {stats.pendingCount} lead{stats.pendingCount === 1 ? "" : "s"}{" "}
                {stats.pendingCount === 1 ? "has" : "have"} never had an enrichment attempt (usually
                from a session aborted before enrichment started) — included in &quot;Retry Failed
                &amp; Pending&quot;.
              </div>
            )}

            {retryResult && (
              <div className="mb-4 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                Retried {retryResult.attempted} lead{retryResult.attempted === 1 ? "" : "s"}:{" "}
                <span className="text-positive font-medium">{retryResult.verified} verified</span>,{" "}
                {retryResult.needsEnrich} no email found, {retryResult.stillFailed} still failed.
                {retryResult.remaining > 0 && (
                  <> {retryResult.remaining} more queued — click retry again to continue.</>
                )}
              </div>
            )}

            {stats.failedLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No failed enrichments.</p>
            ) : (
              <div className="space-y-2">
                {stats.failedLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{lead.businessName}</p>
                        <p className="text-xs text-muted-foreground">{lead.location}</p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          lead.isRateLimited
                            ? "bg-muted text-muted-foreground"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {lead.isRateLimited ? "Rate Limited" : "Failed"}
                      </span>
                    </div>
                    {lead.errorMessage && (
                      <p className="mt-2 truncate rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground" title={lead.errorMessage}>
                        {lead.errorMessage}
                      </p>
                    )}
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
