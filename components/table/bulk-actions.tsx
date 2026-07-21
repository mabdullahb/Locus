"use client";

import { Download, Webhook, Trash2 } from "lucide-react";
import { useLeadsStore } from "@/stores/leads-store";

export function BulkActions() {
  const selectedIds = useLeadsStore((s) => s.selectedIds);
  const clearSelection = useLeadsStore((s) => s.clearSelection);

  if (selectedIds.size === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-2.5">
      <span className="text-sm font-medium text-foreground">
        {selectedIds.size} selected
      </span>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground">
          <Download className="h-3.5 w-3.5" />
          Export Selected
        </button>
        <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground">
          <Webhook className="h-3.5 w-3.5" />
          Push to CRM
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
  );
}
