"use client";

import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/stores/leads-store";

// Purely a status display. The Actions column's dedicated Enrich button
// (data-table.tsx) is the one control that actually triggers enrichment.
const badgeStyles: Record<LeadStatus, string> = {
  verified: "border-accent/30 bg-accent/10 text-accent",
  needs_enrich: "border-border bg-muted text-muted-foreground",
  pending: "border-border bg-muted text-muted-foreground",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
};

const labels: Record<LeadStatus, string> = {
  verified: "Verified",
  needs_enrich: "Needs enrich",
  pending: "Pending",
  failed: "Failed",
};

export function StatusBadge({
  status,
  enriching,
}: {
  status: LeadStatus;
  enriching?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] tracking-wide uppercase",
        badgeStyles[status],
        enriching && "pointer-events-none opacity-70",
      )}
    >
      {enriching && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {enriching ? "Enriching" : labels[status]}
    </span>
  );
}
