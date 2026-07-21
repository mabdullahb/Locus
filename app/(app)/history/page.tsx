"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  AlertTriangle,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  RefreshCw,
} from "lucide-react";
import { useHistoryStore, type SessionStatus } from "@/stores/history-store";
import { useRouter } from "next/navigation";

type SortField = "query" | "location" | "startedAt" | "status" | "yield.leads";
type SortDir = "asc" | "desc";

const statusIcon = {
  completed: CheckCircle2,
  failed: XCircle,
  aborted: AlertCircle,
  running: Clock,
};

const statusLabel = {
  completed: "Completed",
  failed: "Failed",
  aborted: "Aborted",
  running: "Running",
};

function formatDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

interface StatusChipProps {
  status: SessionStatus;
}

function StatusChip({ status }: StatusChipProps) {
  const Icon = statusIcon[status];
  const colorMap: Record<SessionStatus, string> = {
    completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    failed: "bg-red-500/10 text-red-500 border-red-500/20",
    aborted: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    running: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${colorMap[status]}`}>
      <Icon className="h-3 w-3" />
      {statusLabel[status]}
    </span>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const sessions = useHistoryStore((s) => s.sessions);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SessionStatus | "all">("all");
  const [sortField, setSortField] = useState<SortField>("startedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "startedAt" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    let result = [...sessions];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.query.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q) ||
          s.config.proxyType.toLowerCase().includes(q),
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "query":
          cmp = a.query.localeCompare(b.query);
          break;
        case "location":
          cmp = a.location.localeCompare(b.location);
          break;
        case "startedAt":
          cmp = a.startedAt - b.startedAt;
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "yield.leads":
          cmp = a.yield.leads - b.yield.leads;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [sessions, searchQuery, statusFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.min(currentPage, totalPages);
  const start = (clampedPage - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => {
    const active = sortField === field;
    return (
      <button
        onClick={() => toggleSort(field)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {label}
        {active && (
          sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Audit trail of all extraction sessions with configuration snapshots.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 md:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search sessions..."
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {(["all", "completed", "failed", "aborted"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : statusLabel[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3">
                  <SortHeader field="query" label="Query" />
                </th>
                <th className="hidden px-4 py-3 md:table-cell">
                  <SortHeader field="location" label="Location" />
                </th>
                <th className="px-4 py-3">
                  <SortHeader field="startedAt" label="Date" />
                </th>
                <th className="px-4 py-3">
                  <SortHeader field="status" label="Status" />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortHeader field="yield.leads" label="Leads" />
                </th>
                <th className="hidden px-4 py-3 text-right lg:table-cell">Emails</th>
                <th className="hidden px-4 py-3 text-right lg:table-cell">Enriched</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">Duration</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No sessions match your filters.
                  </td>
                </tr>
              ) : (
                paged.map((session) => {
                  return (
                    <tr key={session.id} className="group border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="max-w-[180px] px-4 py-3">
                        <p className="truncate font-medium text-foreground">
                          {session.query}
                        </p>
                      </td>
                      <td className="hidden max-w-[140px] px-4 py-3 md:table-cell">
                        <p className="truncate text-muted-foreground">
                          {session.location}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(session.startedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={session.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {session.yield.leads}
                      </td>
                      <td className="hidden px-4 py-3 text-right text-muted-foreground lg:table-cell">
                        {session.yield.emails}
                      </td>
                      <td className="hidden px-4 py-3 text-right text-muted-foreground lg:table-cell">
                        {session.yield.enriched}
                      </td>
                      <td className="hidden px-4 py-3 text-right text-xs text-muted-foreground sm:table-cell">
                        {formatDuration(session.duration)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="Download CSV"
                            className="rounded p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => router.push("/dashboard")}
                            title="Re-run"
                            className="rounded p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            title="View details"
                            className="rounded p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {paged.some((s) => s.status === "failed") && (
          <div className="border-t border-border">
            {paged
              .filter((s) => s.status === "failed")
              .map((session) => {
                const isErrorExpanded = expandedError === session.id;
                return (
                  <div key={session.id} className="border-b border-border last:border-0">
                    <button
                      onClick={() =>
                        setExpandedError(isErrorExpanded ? null : session.id)
                      }
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs text-muted-foreground hover:bg-red-500/5"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                      <span className="font-medium text-red-500">Failed Session</span>
                      <span className="text-muted-foreground">
                        — {session.query} at {session.location}
                      </span>
                      {isErrorExpanded ? (
                        <ChevronUp className="ml-auto h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0" />
                      )}
                    </button>
                    {isErrorExpanded && (
                      <div className="space-y-3 border-t border-border bg-red-500/[0.02] px-4 py-3">
                        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                          <p className="text-xs font-medium text-red-500">Error Log</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {session.errorLog}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-card p-3">
                          <p className="mb-2 text-xs font-medium text-foreground">
                            Configuration Snapshot
                          </p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                            <span className="text-muted-foreground">Concurrency</span>
                            <span className="text-foreground">{session.config.concurrency} threads</span>
                            <span className="text-muted-foreground">Proxy Type</span>
                            <span className="text-foreground capitalize">{session.config.proxyType}</span>
                            <span className="text-muted-foreground">Enrichment</span>
                            <span className="text-foreground capitalize">{session.config.enrichmentDepth}</span>
                            <span className="text-muted-foreground">Max Results</span>
                            <span className="text-foreground">{session.config.maxResults}</span>
                            <span className="text-muted-foreground">Radius</span>
                            <span className="text-foreground">{session.config.radius} km</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => router.push("/dashboard")}
                            className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/20"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Retry with Premium Proxies
                          </button>
                          <button
                            onClick={() => router.push("/dashboard")}
                            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Re-run with Same Config
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <p className="text-xs text-muted-foreground">
          Showing {start + 1}–{Math.min(start + pageSize, filtered.length)} of{" "}
          {filtered.length} sessions
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={clampedPage <= 1}
            className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - clampedPage) <= 1)
            .map((p, idx, arr) => (
              <span key={p} className="flex items-center">
                {idx > 0 && arr[idx - 1] !== p - 1 && (
                  <span className="px-1 text-muted-foreground">...</span>
                )}
                <button
                  onClick={() => setCurrentPage(p)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                    p === clampedPage
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              </span>
            ))}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={clampedPage >= totalPages}
            className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
