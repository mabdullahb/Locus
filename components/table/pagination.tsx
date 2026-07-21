"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLeadsStore } from "@/stores/leads-store";

export function Pagination({
  currentPage,
  totalPages,
  totalFiltered,
}: {
  currentPage: number;
  totalPages: number;
  totalFiltered: number;
}) {
  const setPage = useLeadsStore((s) => s.setPage);
  const pageSize = useLeadsStore((s) => s.pageSize);
  const setPageSize = useLeadsStore((s) => s.setPageSize);

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalFiltered);

  const pageNumbers: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (currentPage > 3) pageNumbers.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pageNumbers.push(i);
    }
    if (currentPage < totalPages - 2) pageNumbers.push("...");
    pageNumbers.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {start}–{end} of {totalFiltered}
        </span>
        <div className="h-3 w-px bg-border" />
        <label className="flex items-center gap-1">
          <span>Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-2 py-0.5 text-xs text-foreground focus:border-ring focus:outline-none"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageNumbers.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="flex h-7 w-7 items-center justify-center text-xs text-muted-foreground">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => setPage(p as number)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-colors",
                p === currentPage
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => setPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
