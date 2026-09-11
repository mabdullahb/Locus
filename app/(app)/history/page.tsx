"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  Trash2,
  Loader2,
  Eye,
  GitCompare,
} from "lucide-react";
import { useHistoryStore, type SessionStatus } from "@/stores/history-store";
import { SessionCompareModal } from "@/components/history/session-compare-modal";
import { buildRerunUrl } from "@/lib/rerun-params";
import { useRouter } from "next/navigation";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { ColumnResizeHandle } from "@/components/table/column-resize-handle";

// Sums to comfortably fit the table's container at common viewport widths
// without forcing a horizontal scrollbar by default — resizing wider than
// that is the user's call (via drag), not something the defaults should
// force on everyone.
const columnWidthDefaults: Record<string, number> = {
  query: 180,
  location: 140,
  startedAt: 140,
  // 130, not 100: the "Completed" status badge (icon plus text) needs about
  // 90px of content width, and this column's px-4 cell padding already
  // takes 32px of the 100px it used to get, leaving only 68px, so the badge
  // rendered wider than its cell and text-align:center plus overflow-hidden
  // clipped it asymmetrically instead of centering it. Confirmed live via a
  // real seeded "Completed" row before and after this change.
  status: 130,
  leads: 80,
  emails: 85,
  enriched: 100,
  duration: 90,
  // 96, not 72: this column now holds two icon buttons (View, Delete) side
  // by side instead of one, and 72 left no room for the second before this
  // change.
  actions: 96,
};

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

function SortHeader({
  field,
  label,
  align = "left",
  sortField,
  sortDir,
  onToggle,
}: {
  field: SortField;
  label: string;
  align?: "left" | "center" | "right";
  sortField: SortField;
  sortDir: SortDir;
  onToggle: (field: SortField) => void;
}) {
  const active = sortField === field;
  const justify =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  return (
    <button
      onClick={() => onToggle(field)}
      className={`flex w-full items-center gap-1 overflow-hidden text-xs font-medium text-muted-foreground hover:text-foreground ${justify}`}
    >
      <span data-testid="sort-label" className="truncate">{label}</span>
      {active && (
        sortDir === "asc" ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />
      )}
    </button>
  );
}

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
    completed: "bg-positive/10 text-positive border-positive/20",
    failed: "bg-destructive/10 text-destructive border-destructive/20",
    aborted: "border-border bg-muted text-muted-foreground",
    running: "bg-primary/10 text-primary border-primary/20",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wide ${colorMap[status]}`}>
      <Icon className="h-3 w-3" />
      {statusLabel[status]}
    </span>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const sessions = useHistoryStore((s) => s.sessions);
  const replaceSessions = useHistoryStore((s) => s.replaceSessions);
  const removeSession = useHistoryStore((s) => s.removeSession);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [comparingIds, setComparingIds] = useState<[string, string] | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      removeSession(id);
    } catch {
      setDeleteError(id);
      setTimeout(() => setDeleteError(null), 3000);
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setConfirmingBulk(false);
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    setBulkError(null);
    const ids = [...selectedIds];
    const failed: string[] = [];
    await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
          if (!res.ok) throw new Error();
          removeSession(id);
        } catch {
          failed.push(id);
        }
      }),
    );
    setBulkDeleting(false);
    setConfirmingBulk(false);
    setSelectedIds(new Set(failed));
    if (failed.length) {
      setBulkError(`${failed.length} could not be deleted. Try again.`);
      setTimeout(() => setBulkError(null), 4000);
    }
  };
  const handleViewSession = (id: string) => {
    router.push(`/dashboard?viewSession=${id}`);
  };

  const handleRerunSession = (session: (typeof sessions)[number]) => {
    router.push(
      buildRerunUrl({
        keyword: session.config.keyword,
        location: session.config.location,
        enrichmentDepth: session.config.enrichmentDepth,
        radius: session.config.radius,
        locale: session.config.locale,
      }),
    );
  };

  useEffect(() => {
    fetch("/api/history?pageSize=100")
      .then((r) => r.json())
      .then((data) => {
        if (data.sessions?.length) {
          replaceSessions(data.sessions);
        }
      })
      .catch(() => {});
  }, [replaceSessions]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SessionStatus | "all">("all");
  const [sortField, setSortField] = useState<SortField>("startedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const { widths, startResize } = useResizableColumns("locus:col-widths:history", columnWidthDefaults);

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

  const pageIds = paged.map((s) => s.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.01em] text-foreground-strong">History</h1>
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

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
          <span className="font-mono text-xs text-muted-foreground">
            {selectedIds.size} selected
          </span>
          {confirmingBulk ? (
            <>
              <span className="text-xs text-muted-foreground">
                Delete {selectedIds.size} session{selectedIds.size > 1 ? "s" : ""} and their leads?
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="inline-flex items-center gap-1.5 rounded bg-destructive/5 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
              >
                {bulkDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Confirm delete
              </button>
              <button
                onClick={() => setConfirmingBulk(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {selectedIds.size === 2 && (
                <button
                  onClick={() => setComparingIds([...selectedIds] as [string, string])}
                  className="inline-flex items-center gap-1.5 rounded bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
                >
                  <GitCompare className="h-3.5 w-3.5" />
                  Compare
                </button>
              )}
              <button
                onClick={() => setConfirmingBulk(true)}
                className="inline-flex items-center gap-1.5 rounded bg-destructive/5 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete selected
              </button>
              <button
                onClick={clearSelection}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </>
          )}
          {bulkError && (
            <span className="font-mono text-xs text-destructive">{bulkError}</span>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col style={{ width: 44 }} />
              <col style={{ width: widths.query }} />
              <col className="hidden md:table-column" style={{ width: widths.location }} />
              <col style={{ width: widths.startedAt }} />
              <col style={{ width: widths.status }} />
              <col style={{ width: widths.leads }} />
              <col className="hidden lg:table-column" style={{ width: widths.emails }} />
              <col className="hidden lg:table-column" style={{ width: widths.enriched }} />
              <col className="hidden sm:table-column" style={{ width: widths.duration }} />
              <col style={{ width: widths.actions }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={allPageSelected ? "Deselect all on this page" : "Select all on this page"}
                    checked={allPageSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                </th>
                <th className="relative overflow-hidden px-4 py-3">
                  <SortHeader field="query" label="Query" sortField={sortField} sortDir={sortDir} onToggle={toggleSort} />
                  <ColumnResizeHandle onMouseDown={startResize("query")} />
                </th>
                <th className="relative hidden overflow-hidden px-4 py-3 md:table-cell">
                  <SortHeader field="location" label="Location" sortField={sortField} sortDir={sortDir} onToggle={toggleSort} />
                  <ColumnResizeHandle onMouseDown={startResize("location")} />
                </th>
                <th className="relative overflow-hidden px-4 py-3">
                  <SortHeader field="startedAt" label="Date" sortField={sortField} sortDir={sortDir} onToggle={toggleSort} />
                  <ColumnResizeHandle onMouseDown={startResize("startedAt")} />
                </th>
                <th className="relative overflow-hidden px-4 py-3 text-center">
                  <SortHeader field="status" label="Status" align="center" sortField={sortField} sortDir={sortDir} onToggle={toggleSort} />
                  <ColumnResizeHandle onMouseDown={startResize("status")} />
                </th>
                <th className="relative overflow-hidden px-4 py-3 text-center">
                  <SortHeader field="yield.leads" label="Leads" align="center" sortField={sortField} sortDir={sortDir} onToggle={toggleSort} />
                  <ColumnResizeHandle onMouseDown={startResize("leads")} />
                </th>
                <th className="relative hidden overflow-hidden px-4 py-3 text-center lg:table-cell">
                  <span data-testid="sort-label" className="truncate">Emails</span>
                  <ColumnResizeHandle onMouseDown={startResize("emails")} />
                </th>
                <th className="relative hidden overflow-hidden px-4 py-3 text-center lg:table-cell">
                  <span data-testid="sort-label" className="truncate">Enriched</span>
                  <ColumnResizeHandle onMouseDown={startResize("enriched")} />
                </th>
                <th className="relative hidden overflow-hidden px-4 py-3 text-center sm:table-cell">
                  <span data-testid="sort-label" className="truncate">Duration</span>
                  <ColumnResizeHandle onMouseDown={startResize("duration")} />
                </th>
                <th className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No sessions match your filters.
                  </td>
                </tr>
              ) : (
                paged.map((session) => {
                  return (
                    <tr
                      key={session.id}
                      // Mouse-only convenience layered on top of the real
                      // accessible path (the explicit "View" button below):
                      // a role="button" here would make this row a nested
                      // interactive ancestor of that button and the
                      // checkbox, an invalid ARIA pattern axe-core flags as
                      // "nested-interactive". Keyboard and screen-reader
                      // users go through the button, not the row.
                      onClick={() => handleViewSession(session.id)}
                      title="View results from this search"
                      className={`group cursor-pointer border-b border-border last:border-0 hover:bg-muted/30 ${
                        selectedIds.has(session.id) ? "bg-primary/[0.06]" : ""
                      }`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${session.query}`}
                          checked={selectedIds.has(session.id)}
                          onChange={() => toggleSelect(session.id)}
                          className="h-4 w-4 rounded border-input accent-primary"
                        />
                      </td>
                      <td className="overflow-hidden px-4 py-3">
                        <p className="truncate font-medium text-foreground">
                          {session.query}
                        </p>
                      </td>
                      <td className="hidden overflow-hidden px-4 py-3 md:table-cell">
                        <p className="truncate text-muted-foreground">
                          {session.location}
                        </p>
                      </td>
                      <td className="truncate px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(session.startedAt)}
                      </td>
                      <td className="overflow-hidden px-4 py-3 text-center">
                        <StatusChip status={session.status} />
                      </td>
                      <td className="overflow-hidden px-4 py-3 text-center font-medium text-foreground">
                        {session.yield.leads}
                      </td>
                      <td className="hidden overflow-hidden px-4 py-3 text-center text-muted-foreground lg:table-cell">
                        {session.yield.emails}
                      </td>
                      <td className="hidden overflow-hidden px-4 py-3 text-center text-muted-foreground lg:table-cell">
                        {session.yield.enriched}
                      </td>
                      <td className="hidden overflow-hidden px-4 py-3 text-center text-xs text-muted-foreground sm:table-cell">
                        {formatDuration(session.duration)}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {deletingId === session.id ? (
                          <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
                        ) : confirmingId === session.id ? (
                          <span className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(session.id)}
                              className="rounded px-1.5 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/10"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmingId(null)}
                              aria-label="Cancel delete"
                              className="rounded px-1 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5">
                            <button
                              onClick={() => handleViewSession(session.id)}
                              aria-label="View results"
                              title="View this session's results"
                              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground opacity-0 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setConfirmingId(session.id)}
                              aria-label="Delete session"
                              title={
                                deleteError === session.id
                                  ? "Delete failed, try again"
                                  : "Delete this session and its leads"
                              }
                              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground opacity-0 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                            >
                              {deleteError === session.id ? (
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </span>
                        )}
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
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs text-muted-foreground hover:bg-destructive/5"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                      <span className="font-medium text-destructive">Failed Session</span>
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
                      <div className="space-y-3 border-t border-border bg-destructive/[0.03] px-4 py-3">
                        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                          <p className="text-xs font-medium text-destructive">Error Log</p>
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
                            onClick={() => handleRerunSession(session)}
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
            aria-label="Previous page"
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
            aria-label="Next page"
            className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {comparingIds && (
        <SessionCompareModal ids={comparingIds} onClose={() => setComparingIds(null)} />
      )}
    </div>
  );
}
