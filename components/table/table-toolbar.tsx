"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Download, ChevronDown, FileText, FileSpreadsheet, FileCode, Loader2, AlertCircle, RotateCcw, CheckCircle2 } from "lucide-react";
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
  const leads = useLeadsStore((s) => s.leads);
  const replaceLeads = useLeadsStore((s) => s.replaceLeads);

  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retrySummary, setRetrySummary] = useState<string | null>(null);
  const failedCount = leads.filter((l) => l.status === "failed").length;

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
    { label: "CSV", format: "csv" as const, icon: FileText },
    { label: "Excel (XLSX)", format: "xlsx" as const, icon: FileSpreadsheet },
    { label: "JSON", format: "json" as const, icon: FileCode },
  ];

  const exportColumns = [
    { key: "businessName", label: "Business Name" },
    { key: "location", label: "Location" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "status", label: "Status" },
    { key: "createdAt", label: "Created At" },
  ];

  const handleExport = async (format: "csv" | "xlsx" | "json") => {
    setExporting(format);
    setExportOpen(false);
    setExportError(null);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "live",
          format,
          columns: exportColumns,
          data: leads,
        }),
      });

      if (!res.ok) {
        // Error responses are JSON ({error}); success responses are the file
        // blob itself — only parse as JSON on the failure path.
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Export failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?(.+?)"?$/);
      a.download = match?.[1] ?? `locus-export.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setExporting(null);
    }
  };

  const handleRetryFailed = async () => {
    setRetrying(true);
    setRetryError(null);
    setRetrySummary(null);
    try {
      const res = await fetch("/api/enrichment/retry-failed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Retry failed");

      // The retry endpoint mutates leads server-side (status/email) directly
      // in the DB — refetch instead of guessing the new state client-side.
      const leadsRes = await fetch("/api/leads?page=1&pageSize=5000");
      const leadsBody = await leadsRes.json().catch(() => ({}));
      if (leadsBody.leads) replaceLeads(leadsBody.leads);

      setRetrySummary(
        `Retried ${body.attempted} lead${body.attempted === 1 ? "" : "s"} — ` +
          `${body.verified} verified, ${body.needsEnrich} need another attempt, ${body.stillFailed} still failed` +
          (body.remaining > 0 ? ` (${body.remaining} more queued — click Retry Failed again)` : ""),
      );
    } catch (err) {
      setRetryError((err as Error).message);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {exportError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}
      {retryError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{retryError}</span>
        </div>
      )}
      {retrySummary && (
        <div className="flex items-center gap-2 rounded-lg border border-positive/40 bg-positive/10 px-4 py-2.5 text-sm text-positive">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{retrySummary}</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        {failedCount > 0 && (
          <button
            onClick={handleRetryFailed}
            disabled={retrying}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {retrying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {retrying ? "Retrying..." : `Retry Failed (${failedCount})`}
          </button>
        )}
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
            disabled={exporting !== null}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? `Exporting ${exporting.toUpperCase()}...` : "Export"}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
              {exportOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.label}
                    onClick={() => handleExport(opt.format)}
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
