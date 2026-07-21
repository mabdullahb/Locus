"use client";

import { useState } from "react";
import { Search, Command, History, LogOut, Menu } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useHistoryStore } from "@/stores/history-store";
import { useUIStore } from "@/stores/ui-store";

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Topbar() {
  const { data: session } = useSession();
  const togglePanel = useHistoryStore((s) => s.togglePanel);
  const sessionCount = useHistoryStore((s) => s.sessions.length);
  const toggleMobileSidebar = useUIStore((s) => s.toggleMobileSidebar);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-4 lg:px-6">
      <button
        onClick={toggleMobileSidebar}
        className="flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative flex flex-1 items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search queries, leads, configurations..."
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

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground hover:bg-muted/80"
          >
            {session?.user ? getInitials(session.user.name || session.user.email) : "U"}
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-10 z-20 w-48 rounded-xl border border-border bg-card p-2 shadow-lg">
                <div className="border-b border-border px-3 py-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {session?.user?.name || session?.user?.email || "User"}
                  </p>
                  {session?.user?.email && (
                    <p className="truncate text-xs text-muted-foreground">
                      {session.user.email}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
