"use client";

import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/stores/leads-store";

const badgeStyles: Record<LeadStatus, string> = {
  verified:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  needs_enrich:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 cursor-pointer hover:bg-amber-500/20",
  pending:
    "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20",
  failed:
    "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const labels: Record<LeadStatus, string> = {
  verified: "Verified",
  needs_enrich: "Enrich",
  pending: "Pending",
  failed: "Failed",
};

export function StatusBadge({
  status,
  enriching,
  onClick,
}: {
  status: LeadStatus;
  enriching?: boolean;
  onClick?: () => void;
}) {
  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        badgeStyles[status],
        enriching && "pointer-events-none opacity-70",
      )}
    >
      {enriching && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {enriching ? "Enriching..." : labels[status]}
    </span>
  );
}
