"use client";

import { StatsRow } from "@/components/dashboard/stats-row";
import { CommandCenter } from "@/components/dashboard/command-center";
import { LiveMetricsRow } from "@/components/dashboard/live-metrics-row";
import { ProgressPipeline } from "@/components/dashboard/progress-pipeline";
import { DataTable } from "@/components/table/data-table";
import { useExtractionStore } from "@/stores/extraction-store";

export default function DashboardPage() {
  const status = useExtractionStore((s) => s.status);
  const showProgress = status !== "idle";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor extraction jobs, track leads, and manage your workspace.
        </p>
      </div>
      <StatsRow />
      <CommandCenter />
      {showProgress && (
        <div className="animate-slide-up space-y-4">
          <LiveMetricsRow />
          <ProgressPipeline />
        </div>
      )}
      <DataTable />
    </div>
  );
}
