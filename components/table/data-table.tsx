"use client";

import { useEffect, useRef } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  MapPin,
  Loader2,
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

interface ColumnDef {
  key: string;
  label: string;
  sortable: boolean;
  className?: string;
}

const columns: ColumnDef[] = [
  { key: "select", label: "", sortable: false, className: "w-10" },
  { key: "businessName", label: "Business Name", sortable: true },
  { key: "location", label: "Location", sortable: true, className: "hidden md:table-cell" },
  { key: "phone", label: "Phone Number", sortable: true, className: "hidden lg:table-cell" },
  { key: "email", label: "Email Address", sortable: true },
  { key: "status", label: "Status", sortable: true, className: "w-28" },
  { key: "actions", label: "Actions", sortable: false, className: "w-20" },
];

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

function NewRowFlash({ children }: { children: React.ReactNode }) {
  return <div className="animate-slide-up">{children}</div>;
}

export function DataTable() {
  const sortColumn = useLeadsStore((s) => s.sortColumn);
  const sortDirection = useLeadsStore((s) => s.sortDirection);
  const setSort = useLeadsStore((s) => s.setSort);
  const selectedIds = useLeadsStore((s) => s.selectedIds);
  const toggleSelect = useLeadsStore((s) => s.toggleSelect);
  const selectAll = useLeadsStore((s) => s.selectAll);
  const triggerEnrich = useLeadsStore((s) => s.triggerEnrich);
  const searchQuery = useLeadsStore((s) => s.searchQuery);
  const statusFilter = useLeadsStore((s) => s.statusFilter);

  const { pagedLeads, totalFiltered, totalPages, currentPage } = useFilteredLeads();
  const prevLengthRef = useRef(pagedLeads.length);

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
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">
          Leads Data Table
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Browse, filter, and manage extracted business leads.
        </p>
      </div>

      <BulkActions />
      <TableToolbar totalCount={totalFiltered} />

      {isEmpty ? (
        <EmptyState isSearch={searchQuery.trim() !== "" || statusFilter !== "all"} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {columns.map((col) => {
                    if (col.key === "select") {
                      return (
                        <th key={col.key} className={cn("h-10 px-3", col.className)}>
                          <input
                            type="checkbox"
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
                          "h-10 px-3 text-left",
                          col.sortable && "cursor-pointer select-none",
                          col.className,
                        )}
                        onClick={() => col.sortable && handleSort(col.key)}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {col.label}
                          </span>
                          {col.sortable && (
                            <SortIcon activeDirection={getSortDirection(col.key)} />
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pagedLeads.map((lead) => (
                  <NewRowFlash key={lead.id}>
                    <tr className="border-b border-border transition-colors last:border-0 hover:bg-muted/30">
                      <td className="h-12 px-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="px-3">
                        <div className="flex items-center gap-3">
                          <AvatarInitials name={lead.businessName} />
                          <span className="text-sm font-medium text-foreground">
                            {lead.businessName}
                          </span>
                        </div>
                      </td>
                      <td className="hidden px-3 md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {lead.location}
                          </span>
                        </div>
                      </td>
                      <td className="hidden px-3 lg:table-cell">
                        <span className="font-mono text-sm text-foreground">
                          {lead.phone}
                        </span>
                      </td>
                      <td className="px-3">
                        <span className="font-mono text-sm text-foreground">
                          {lead.email}
                        </span>
                      </td>
                      <td className="px-3">
                        <StatusBadge
                          status={lead.status}
                          enriching={false}
                          onClick={
                            lead.status === "needs_enrich"
                              ? () => triggerEnrich(lead.id)
                              : undefined
                          }
                        />
                      </td>
                      <td className="px-3">
                        {lead.status === "needs_enrich" ? (
                          <button
                            onClick={() => triggerEnrich(lead.id)}
                            className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400"
                          >
                            <Loader2 className="h-3 w-3" />
                            Enrich
                          </button>
                        ) : (
                          <button className="text-xs text-muted-foreground hover:text-foreground">
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  </NewRowFlash>
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
    </div>
  );
}
