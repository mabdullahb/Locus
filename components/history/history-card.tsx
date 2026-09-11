"use client";

import { useState } from "react";
import {
  Download,
  RotateCcw,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
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
    className: "text-positive",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    className: "text-destructive",
  },
  aborted: {
    icon: AlertCircle,
    label: "Aborted",
    className: "text-muted-foreground",
  },
  running: {
    icon: Clock,
    label: "Running",
    className: "text-primary",
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

  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  // Live/in-progress rows are synthesized client-side (id like
  // "hist-live-<timestamp>") before the real session lands from the DB —
  // there's no ScrapeSession to export yet.
  const isLivePlaceholder = session.id.startsWith("hist-live-");

  const handleDownload = async () => {
    if (downloading || isLivePlaceholder) return;
    setDownloading(true);
    setDownloadFailed(false);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, format: "csv" }),
      });
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?(.+?)"?$/);
      a.download = match?.[1] ?? `locus-session-${session.id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setDownloadFailed(true);
      setTimeout(() => setDownloadFailed(false), 3000);
    } finally {
      setDownloading(false);
    }
  };

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
            onClick={handleDownload}
            disabled={downloading || isLivePlaceholder}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title={
              isLivePlaceholder
                ? "Still running — wait for it to finish"
                : downloadFailed
                  ? "Download failed — try again"
                  : "Download CSV"
            }
            aria-label={
              isLivePlaceholder
                ? "Still running, wait for it to finish"
                : downloadFailed
                  ? "Download failed, try again"
                  : "Download CSV"
            }
          >
            {downloading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : downloadFailed ? (
              <AlertCircle className="h-3 w-3 text-destructive" />
            ) : (
              <Download className="h-3 w-3" />
            )}
          </button>
          <button
            onClick={() => onViewDetails(session)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="View details"
            aria-label="View details"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
