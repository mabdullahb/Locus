"use client";

import { Search, Command, History } from "lucide-react";
import { useHistoryStore } from "@/stores/history-store";

export function Topbar() {
  const togglePanel = useHistoryStore((s) => s.togglePanel);
  const sessionCount = useHistoryStore((s) => s.sessions.length);

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-6">
      <div className="relative flex flex-1 items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search queries, leads, configurations... (Cmd+K)"
          className="h-9 w-full max-w-md rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <kbd className="ml-2 hidden items-center gap-1 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:flex">
          <Command className="h-3 w-3" />
          K
        </kbd>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={togglePanel}
          className="relative flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">History</span>
          {sessionCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {sessionCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            All Systems Nominal
          </span>
        </div>
      </div>
    </header>
  );
}
