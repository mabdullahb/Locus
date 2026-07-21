"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Download, ChevronDown, FileText, FileSpreadsheet, FileCode, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLeadsStore, type StatusFilter } from "@/stores/leads-store";

const filterChips: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Verified", value: "verified" },
  { label: "Needs Enrich", value: "needs_enrich" },
  { label: "Pending", value: "pending" },
  { label: "Failed", value: "failed" },
];

export function TableToolbar({ totalCount }: { totalCount: number }) {
  const searchQuery = useLeadsStore((s) => s.searchQuery);
  const statusFilter = useLeadsStore((s) => s.statusFilter);
  const setSearch = useLeadsStore((s) => s.setSearch);
  const setStatusFilter = useLeadsStore((s) => s.setStatusFilter);

  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const exportOptions = [
    { label: "CSV", icon: FileText },
    { label: "Excel (XLSX)", icon: FileSpreadsheet },
    { label: "JSON", icon: FileCode },
    { label: "Push to CRM", icon: Webhook },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, location, phone, or email..."
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Download className="h-4 w-4" />
            Export
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
              {exportOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.label}
                    onClick={() => setExportOpen(false)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {filterChips.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setStatusFilter(chip.value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === chip.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {totalCount} result{totalCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
