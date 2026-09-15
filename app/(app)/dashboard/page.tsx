"use client";

import { useEffect, Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { StatsRow } from "@/components/dashboard/stats-row";
import { CommandCenter } from "@/components/dashboard/command-center";
import { LiveMetricsRow } from "@/components/dashboard/live-metrics-row";
import { ProgressPipeline } from "@/components/dashboard/progress-pipeline";
import { SessionFilterBanner } from "@/components/dashboard/session-filter-banner";
import { DataTable } from "@/components/table/data-table";
import { useExtractionStore } from "@/stores/extraction-store";
import { useScrapeWebSocket } from "@/hooks/useScrapeWebSocket";

export default function DashboardPage() {
  const status = useExtractionStore((s) => s.status);
  const sessionId = useExtractionStore((s) => s.sessionId);
  const hydrateResumable = useExtractionStore((s) => s.hydrateResumable);
  const showProgress = status !== "idle";

  useScrapeWebSocket(sessionId);

  // A completed search's "Load 100 more" only lives in this in-memory store,
  // a fresh page load resets it to idle, silently losing the option even
  // though the provider genuinely has more results. Re-derive it from the
  // last completed session that still has more available, but only on a
  // truly idle mount (never clobber a live or just-finished run already
  // tracked in the store).
  useEffect(() => {
    if (status !== "idle") return;
    fetch("/api/scrape/resumable")
      .then((r) => r.json())
      .then((data) => {
        if (data.session) hydrateResumable(data.session);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Dashboard" />
      <StatsRow />
      {/* CommandCenter reads useSearchParams() for the History "Re-run"
          hand-off, Next.js requires that behind a Suspense boundary. */}
      <Suspense fallback={null}>
        <CommandCenter />
      </Suspense>
      {showProgress && (
        <div className="animate-slide-up space-y-4">
          <LiveMetricsRow />
          <ProgressPipeline />
        </div>
      )}
      {/* Also owns the leads fetch (all leads, or one session's leads when
          navigated here from History), since which one depends on the same
          URL param this reads, so it needs the same Suspense boundary. */}
      <Suspense fallback={null}>
        <SessionFilterBanner />
      </Suspense>
      <DataTable />
    </div>
  );
}
