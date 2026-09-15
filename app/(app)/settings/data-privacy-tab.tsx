"use client";

import { useState } from "react";
import { Download, AlertCircle, Loader2 } from "lucide-react";

export function DataPrivacyTab() {
  const [downloadingFormat, setDownloadingFormat] = useState<"json" | "xlsx" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const downloadData = async (format: "json" | "xlsx") => {
    setDownloadingFormat(format);
    setError(null);
    try {
      const res = await fetch(`/api/account/export${format === "xlsx" ? "?format=xlsx" : ""}`);
      if (!res.ok) throw new Error("Failed to export data");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = format === "xlsx" ? "locus-data-export.xlsx" : "locus-data-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center gap-3">
        <Download className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Data &amp; Privacy</h2>
          <p className="text-xs text-muted-foreground">
            Download everything Locus has stored for your account.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <p className="mb-4 text-sm text-muted-foreground">
        Includes your profile, every scrape session and extracted lead, enrichment results, export
        history, and API key metadata (never the raw keys themselves).
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => downloadData("json")}
          disabled={downloadingFormat !== null}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloadingFormat === "json" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Download as JSON
        </button>
        <button
          onClick={() => downloadData("xlsx")}
          disabled={downloadingFormat !== null}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloadingFormat === "xlsx" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Download as Excel (.xlsx)
        </button>
      </div>
    </div>
  );
}
