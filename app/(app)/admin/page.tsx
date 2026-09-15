"use client";

import { useState, useEffect, useMemo } from "react";
import { Users, Search, ShieldCheck, Loader2, AlertCircle, Crown } from "lucide-react";

interface AdminStats {
  totalUsers: number;
  totalExtractions: number;
  totalEnrichmentAttempts: number;
  successfulEnrichments: number;
  enrichmentSuccessRate: number;
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  createdAt: string;
  extractionCount: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load admin stats");
        }
        return res.json();
      }),
      fetch("/api/admin/users").then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load users");
        }
        return res.json();
      }),
    ])
      .then(([statsBody, usersBody]) => {
        setStats(statsBody);
        setUsers(usersBody.users);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.email.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q),
    );
  }, [users, query]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-[22px] font-semibold tracking-[-0.01em] text-foreground-strong">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Platform-wide usage stats, across all users.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading stats...
        </div>
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Total Users</span>
            </div>
            <p className="mt-2 font-mono text-[26px] font-medium tracking-[-0.01em] tabular-nums text-foreground-strong">
              {stats.totalUsers.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Search className="h-4 w-4" />
              <span className="text-xs font-medium">Total Extractions</span>
            </div>
            <p className="mt-2 font-mono text-[26px] font-medium tracking-[-0.01em] tabular-nums text-foreground-strong">
              {stats.totalExtractions.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-medium">Enrichment Success Rate</span>
            </div>
            <p className="mt-2 font-mono text-[26px] font-medium tracking-[-0.01em] tabular-nums text-foreground-strong">
              {stats.enrichmentSuccessRate}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.successfulEnrichments.toLocaleString()} / {stats.totalEnrichmentAttempts.toLocaleString()} attempts
            </p>
          </div>
        </div>
      ) : null}

      {!loading && users && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">Users</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by email or name"
                aria-label="Search users"
                className="h-9 w-64 rounded-lg border border-input bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="h-10 px-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Email
                    </th>
                    <th className="h-10 px-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Extractions
                    </th>
                    <th className="h-10 px-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        No users match &quot;{query}&quot;.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-foreground">{u.email}</span>
                            {u.isAdmin && (
                              <Crown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Admin" />
                            )}
                          </div>
                          {u.name && <p className="text-xs text-muted-foreground">{u.name}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-sm text-foreground">
                          {u.extractionCount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
