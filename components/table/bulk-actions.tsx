"use client";

import { useState } from "react";
import { Download, Webhook, Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useLeadsStore } from "@/stores/leads-store";

export function BulkActions() {
  const selectedIds = useLeadsStore((s) => s.selectedIds);
  const clearSelection = useLeadsStore((s) => s.clearSelection);
  const leads = useLeadsStore((s) => s.leads);

  const [exporting, setExporting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  if (selectedIds.size === 0) return null;

  const selectedLeads = leads.filter((l) => selectedIds.has(l.id));

  const handleExportSelected = async () => {
    setExporting(true);
    setStatus(null);
    try {
      const columns = [
        { key: "businessName", label: "Business Name" },
        { key: "location", label: "Location" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "status", label: "Status" },
        { key: "createdAt", label: "Created At" },
      ];

      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "live",
          format: "csv",
          columns,
          data: selectedLeads,
        }),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?(.+?)"?$/);
      a.download = match?.[1] ?? "locus-selected-export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setStatus({ type: "success", message: `${selectedIds.size} leads exported` });
    } catch {
      setStatus({ type: "error", message: "Export failed" });
    } finally {
      setExporting(false);
    }
  };

  const handlePushToWebhook = async () => {
    setPushing(true);
    setStatus(null);
    try {
      const res = await fetch("/api/export/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "live",
          data: selectedLeads,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: "success", message: `${selectedIds.size} leads pushed to webhook` });
      } else {
        setStatus({ type: "error", message: data.error || data.message || "Webhook push failed" });
      }
    } catch {
      setStatus({ type: "error", message: "Webhook push failed" });
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-2.5">
        <span className="text-sm font-medium text-foreground">
          {selectedIds.size} selected
        </span>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExportSelected}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Export Selected
          </button>
          <button
            onClick={handlePushToWebhook}
            disabled={pushing}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pushing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Webhook className="h-3.5 w-3.5" />
            )}
            Push to Webhook
          </button>
          <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-background">
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
        <button
          onClick={clearSelection}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          Clear selection
        </button>
      </div>
      {status && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
            status.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {status.type === "success" ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          {status.message}
        </div>
      )}
    </div>
  );
}
