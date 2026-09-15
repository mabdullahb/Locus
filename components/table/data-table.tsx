"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  MapPin,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useLeadsStore,
  useFilteredLeads,
  type SortColumn,
} from "@/stores/leads-store";
import { StatusBadge } from "./status-badge";
import { TableToolbar } from "./table-toolbar";
import { BulkActions } from "./bulk-actions";
import { Pagination } from "./pagination";
import { EmptyState } from "./empty-state";
import { LeadDetailModal } from "./lead-detail-modal";
import { ColumnResizeHandle } from "./column-resize-handle";
import { useResizableColumns } from "@/hooks/useResizableColumns";

interface ColumnDef {
  key: string;
  label: string;
  sortable: boolean;
  className?: string;
  align?: "left" | "center";
  resizable?: boolean;
}

const columns: ColumnDef[] = [
  { key: "select", label: "", sortable: false, className: "w-10", resizable: false },
  { key: "businessName", label: "Business Name", sortable: true },
  { key: "location", label: "Location", sortable: true, className: "hidden md:table-cell" },
  { key: "phone", label: "Phone Number", sortable: true, className: "hidden lg:table-cell" },
  { key: "email", label: "Email Address", sortable: true },
  { key: "status", label: "Status", sortable: true, align: "center" },
  { key: "actions", label: "Actions", sortable: false, align: "center" },
];

// Sums to comfortably fit the table's container at common viewport widths
// without forcing a horizontal scrollbar by default — resizing wider than
// that is the user's call (via drag), not something the defaults should
// force on everyone.
const columnWidthDefaults: Record<string, number> = {
  select: 40,
  businessName: 210,
  location: 150,
  phone: 150,
  email: 190,
  status: 120,
  // 130, not 90: a "failed" lead shows both a "Retry" (icon plus text) and a
  // "View" button side by side, needing about 90px of content width against
  // this column's px-3 padding (24px), so the pair overflowed the old 90px
  // column and rendered off-center under overflow-hidden instead of
  // centered. Confirmed live via a real seeded failed-lead row.
  actions: 130,
};

// <colgroup> uses "table-column" display, not "table-cell" — same
// responsive breakpoints as the <th>/<td>, translated to the right value.
function colVisibilityClass(className?: string): string | undefined {
  return className?.replace(/table-cell/g, "table-column");
}

const sortColumnMap: Record<string, SortColumn> = {
  businessName: "businessName",
  location: "location",
  phone: "phone",
  email: "email",
  status: "status",
};

function SortIcon({ activeDirection }: { activeDirection: "asc" | "desc" | null }) {
  if (!activeDirection) return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
  return activeDirection === "asc" ? (
    <ChevronUp className="h-3.5 w-3.5 text-foreground" />
  ) : (
    <ChevronDown className="h-3.5 w-3.5 text-foreground" />
  );
}

function AvatarInitials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-[11px] font-semibold text-muted-foreground">
      {initials}
    </div>
  );
}

export function DataTable() {
  const sortColumn = useLeadsStore((s) => s.sortColumn);
  const sortDirection = useLeadsStore((s) => s.sortDirection);
  const setSort = useLeadsStore((s) => s.setSort);
  const selectedIds = useLeadsStore((s) => s.selectedIds);
  const toggleSelect = useLeadsStore((s) => s.toggleSelect);
  const selectAll = useLeadsStore((s) => s.selectAll);
  const triggerEnrich = useLeadsStore((s) => s.triggerEnrich);
  const enrichingId = useLeadsStore((s) => s.enrichingId);
  const enrichError = useLeadsStore((s) => s.enrichError);
  const searchQuery = useLeadsStore((s) => s.searchQuery);
  const statusFilter = useLeadsStore((s) => s.statusFilter);

  const { pagedLeads, totalFiltered, totalPages, currentPage } = useFilteredLeads();
  const prevLengthRef = useRef(pagedLeads.length);
  const [viewLeadId, setViewLeadId] = useState<string | null>(null);
  const { widths, startResize } = useResizableColumns(
    "locus:col-widths:dashboard-leads",
    columnWidthDefaults,
  );

  useEffect(() => {
    prevLengthRef.current = pagedLeads.length;
  }, [pagedLeads.length]);

  const handleSort = (key: string) => {
    const col = sortColumnMap[key];
    if (col) setSort(col);
  };

  const getSortDirection = (key: string): "asc" | "desc" | null => {
    const col = sortColumnMap[key];
    return col && sortColumn === col ? sortDirection : null;
  };

  const allPageIds = pagedLeads.map((l) => l.id);
  const allSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));

  const isEmpty = pagedLeads.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground/90">
        Leads
      </p>

      <BulkActions />
      <TableToolbar totalCount={totalFiltered} />

      {enrichError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{enrichError}</span>
        </div>
      )}

      {isEmpty ? (
        <EmptyState isSearch={searchQuery.trim() !== "" || statusFilter !== "all"} />
      ) : (
        <div className="overflow-hidden border-y border-border">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                {columns.map((col) => (
                  <col
                    key={col.key}
                    className={colVisibilityClass(col.className)}
                    style={{ width: widths[col.key] ?? columnWidthDefaults[col.key] }}
                  />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-border">
                  {columns.map((col) => {
                    if (col.key === "select") {
                      return (
                        <th key={col.key} className={cn("h-10 px-3", col.className)}>
                          <input
                            type="checkbox"
                            aria-label={allSelected ? "Deselect all leads" : "Select all leads"}
                            checked={allSelected}
                            onChange={() => selectAll(allPageIds)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                        </th>
                      );
                    }
                    return (
                      <th
                        key={col.key}
                        className={cn(
                          "relative h-10 px-3",
                          col.align === "center" ? "text-center" : "text-left",
                          col.sortable && "cursor-pointer select-none",
                          col.className,
                        )}
                        onClick={() => col.sortable && handleSort(col.key)}
                      >
                        <div
                          className={cn(
                            "flex items-center gap-1.5 overflow-hidden",
                            col.align === "center" && "justify-center",
                          )}
                        >
                          <span
                            data-testid="sort-label"
                            className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                          >
                            {col.label}
                          </span>
                          {col.sortable &&
                            // A permanently-visible icon next to a centered
                            // label shifts the label off true center (the
                            // flex row centers the label+icon pair, not the
                            // label alone) — only show it once this column
                            // is actively sorted, matching how left-aligned
                            // columns don't have this problem in the first
                            // place (an icon after the first flex item
                            // never moves that item's own position).
                            (col.align !== "center" || getSortDirection(col.key)) && (
                              <SortIcon activeDirection={getSortDirection(col.key)} />
                            )}
                        </div>
                        {col.resizable !== false && (
                          <ColumnResizeHandle onMouseDown={startResize(col.key)} />
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pagedLeads.map((lead, i) => (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i, 12) * 0.02, ease: "easeOut" }}
                    className="border-b border-border transition-colors last:border-0 hover:bg-muted/30">
                      <td className="h-12 px-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${lead.businessName}`}
                          checked={selectedIds.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="overflow-hidden px-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <AvatarInitials name={lead.businessName} />
                          <span className="truncate text-sm font-medium text-foreground">
                            {lead.businessName}
                          </span>
                        </div>
                      </td>
                      <td className="hidden overflow-hidden px-3 md:table-cell">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm text-muted-foreground">
                            {lead.location}
                          </span>
                        </div>
                      </td>
                      <td className="hidden overflow-hidden px-3 lg:table-cell">
                        <span className="block truncate font-mono text-sm text-foreground">
                          {lead.phone}
                        </span>
                      </td>
                      <td className="overflow-hidden px-3">
                        <span className="block truncate font-mono text-sm text-foreground">
                          {lead.email}
                        </span>
                      </td>
                      <td className="overflow-hidden px-3 text-center">
                        <StatusBadge
                          status={lead.status}
                          enriching={enrichingId === lead.id}
                        />
                      </td>
                      <td className="overflow-hidden px-3 text-center">
                        <div className="flex items-center justify-center gap-3">
                          {(lead.status === "needs_enrich" ||
                            lead.status === "pending" ||
                            lead.status === "failed") && (
                            <button
                              onClick={() => triggerEnrich(lead.id)}
                              disabled={enrichingId === lead.id}
                              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Loader2 className={cn("h-3 w-3", enrichingId === lead.id && "animate-spin")} />
                              {enrichingId === lead.id
                                ? "Enriching..."
                                : lead.status === "failed"
                                  ? "Retry"
                                  : "Enrich"}
                            </button>
                          )}
                          {lead.status !== "needs_enrich" && lead.status !== "pending" && (
                            <button
                              onClick={() => setViewLeadId(lead.id)}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              View
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isEmpty && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalFiltered={totalFiltered}
        />
      )}

      {viewLeadId && (
        <LeadDetailModal leadId={viewLeadId} onClose={() => setViewLeadId(null)} />
      )}
    </div>
  );
}
