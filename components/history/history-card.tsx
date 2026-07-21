"use client";

import {
  Download,
  RotateCcw,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import type { HistorySession } from "@/stores/history-store";

interface HistoryCardProps {
  session: HistorySession;
  onReRun: (session: HistorySession) => void;
  onViewDetails: (session: HistorySession) => void;
}

const statusConfig = {
  completed: {
    icon: CheckCircle2,
    label: "Completed",
    className: "text-emerald-500",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    className: "text-red-500",
  },
  aborted: {
    icon: AlertCircle,
    label: "Aborted",
    className: "text-amber-500",
  },
  running: {
    icon: Clock,
    label: "Running",
    className: "text-blue-500",
  },
};

function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function HistoryCard({ session, onReRun, onViewDetails }: HistoryCardProps) {
  const StatusIcon = statusConfig[session.status].icon;
  const statusClass = statusConfig[session.status].className;

  return (
    <div className="group rounded-lg border border-border bg-card p-3 transition-all hover:border-accent/30 hover:shadow-sm">
      <div className="mb-2 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {session.query}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {session.location}
          </p>
        </div>
        <div className={`flex shrink-0 items-center gap-1 text-xs font-medium ${statusClass}`}>
          <StatusIcon className="h-3 w-3" />
          {statusConfig[session.status].label}
        </div>
      </div>

      <div className="mb-2 grid grid-cols-3 gap-1 text-center text-[11px]">
        <div>
          <p className="font-semibold text-foreground">{session.yield.leads}</p>
          <p className="text-muted-foreground">Leads</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">{session.yield.emails}</p>
          <p className="text-muted-foreground">Emails</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">{session.yield.enriched}</p>
          <p className="text-muted-foreground">Enriched</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
        <span>
          {formatDate(session.startedAt)}
          {session.duration ? ` · ${formatDuration(session.duration)}` : ""}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onReRun(session)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Re-run with same config"
          >
            <RotateCcw className="h-3 w-3" />
            Re-run
          </button>
          <span className="text-border">|</span>
          <button
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Download CSV"
          >
            <Download className="h-3 w-3" />
          </button>
          <button
            onClick={() => onViewDetails(session)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="View details"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
