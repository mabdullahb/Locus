"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  History,
  Brain,
  Puzzle,
  BarChart3,
  Key,
  Shield,
  ShieldAlert,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useUIStore } from "@/stores/ui-store";
import { LocusMark, LocusWordmark } from "@/components/brand/logo";

const navGroups = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/history", label: "History", icon: History },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/enrichment", label: "AI Enrichment", icon: Brain },
      { href: "/integrations", label: "Integrations", icon: Puzzle },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/api-keys", label: "API Keys", icon: Key },
      { href: "/proxy", label: "Proxy Management", icon: Shield },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const mobileSidebarOpen = useUIStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const user = session?.user;
  const isAdmin = (user as { isAdmin?: boolean } | undefined)?.isAdmin ?? false;

  // Role check on the existing nav, not a separate dashboard, the actual
  // access control lives server-side in /api/admin/stats regardless of
  // whether this link is visible.
  const visibleNavGroups = isAdmin
    ? [...navGroups, { label: "Admin", items: [{ href: "/admin", label: "Admin", icon: ShieldAlert }] }]
    : navGroups;

  const sidebarContent = (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex h-14 items-center border-b border-sidebar-border px-5">
        <Link
          href="/dashboard"
          aria-label="Locus home"
          className="flex items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? (
            <LocusMark className="h-7 w-7 text-primary" />
          ) : (
            <LocusWordmark className="h-[26px] w-auto text-sidebar-foreground" />
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {visibleNavGroups.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <p className="mb-1 px-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const itemPath = item.href.split("?")[0];
              const active = pathname === itemPath;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={cn(
                    "relative mx-2 flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
                    collapsed && "mx-0 justify-center px-2",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-sidebar-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg p-2",
            collapsed && "justify-center",
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {user ? getInitials(user.name || user.email) : "U"}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user?.name || user?.email || "User"}
              </p>
              {user?.name && (
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden h-8 items-center justify-center border-t border-sidebar-border text-muted-foreground hover:text-sidebar-foreground lg:flex"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <div
            className="h-full w-60 animate-slide-up bg-sidebar shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <Link
                href="/dashboard"
                aria-label="Locus home"
                onClick={() => setMobileSidebarOpen(false)}
                className="flex items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LocusWordmark className="h-[26px] w-auto text-sidebar-foreground" />
              </Link>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Close navigation menu"
                className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="overflow-y-auto py-4">
              {visibleNavGroups.map((group) => (
                <div key={group.label} className="mb-4">
                  <p className="mb-1 px-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const itemPath = item.href.split("?")[0];
                    const active = pathname === itemPath;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2 text-sm transition-colors",
                          active
                            ? "border-r-2 border-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex">{sidebarContent}</div>
    </>
  );
}
