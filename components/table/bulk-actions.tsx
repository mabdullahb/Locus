"use client";

import { useState } from "react";
import { Download, Webhook, Trash2, Loader2, CheckCircle2, AlertCircle, TriangleAlert } from "lucide-react";
import { useLeadsStore } from "@/stores/leads-store";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

export function BulkActions() {
  const selectedIds = useLeadsStore((s) => s.selectedIds);
  const clearSelection = useLeadsStore((s) => s.clearSelection);
  const leads = useLeadsStore((s) => s.leads);
  const removeLeads = useLeadsStore((s) => s.removeLeads);

  const [exporting, setExporting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEscapeToClose(() => {
    if (confirmingDelete) setConfirmingDelete(false);
  });

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

  const handleDelete = async () => {
    setConfirmingDelete(false);
    const ids = Array.from(selectedIds);
    setDeleting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ type: "error", message: data.error || "Delete failed" });
        return;
      }
      removeLeads(ids);
      setStatus({ type: "success", message: `${data.deleted} lead${data.deleted === 1 ? "" : "s"} deleted` });
    } catch {
      setStatus({ type: "error", message: "Delete failed — network error" });
    } finally {
      setDeleting(false);
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
          <button
            onClick={() => setConfirmingDelete(true)}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-destructive hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
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
              ? "border-positive/40 bg-positive/10 text-positive"
              : "border-destructive/40 bg-destructive/10 text-destructive"
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

      {confirmingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setConfirmingDelete(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive bg-destructive/10 text-destructive">
                <TriangleAlert className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold text-foreground">
                  Delete {selectedIds.size} lead{selectedIds.size === 1 ? "" : "s"}?
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This permanently removes {selectedIds.size === 1 ? "it" : "them"} and any enrichment
                  history. This can&apos;t be undone.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="h-9 rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="h-9 rounded-lg bg-destructive-solid px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive-solid/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
