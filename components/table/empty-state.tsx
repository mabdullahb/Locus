"use client";

import { Database, Search } from "lucide-react";

export function EmptyState({
  isSearch,
}: {
  isSearch: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted/50">
        {isSearch ? (
          <Search className="h-6 w-6 text-muted-foreground" />
        ) : (
          <Database className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <h3 className="font-display text-base font-semibold text-foreground">
        {isSearch ? "No matching results" : "No leads yet"}
      </h3>
      <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
        {isSearch
          ? "Try adjusting your search query or filter to find what you're looking for."
          : "Configure your extraction parameters above and start your first scrape to begin collecting leads."}
      </p>
      {!isSearch && (
        <button className="mt-4 flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Database className="h-4 w-4" />
          Start Extraction
        </button>
      )}
    </div>
  );
}
