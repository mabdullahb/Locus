"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { ShieldCheck, Monitor, AlertCircle, Loader2, LogOut } from "lucide-react";

interface SessionRow {
  id: string;
  device: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SecurityTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/sessions");
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      setError("Failed to load active sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchSessions();
    });
  }, []);

  const revoke = async (id: string) => {
    setRevoking(id);
    setConfirmingRevoke(null);
    setError(null);
    try {
      const res = await fetch(`/api/account/sessions?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke session");
      const data = await res.json();
      if (data.revokedCurrent) {
        signOut({ callbackUrl: "/login" });
        return;
      }
      await fetchSessions();
    } catch {
      setError("Failed to revoke session");
      setRevoking(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Security</h2>
          <p className="text-xs text-muted-foreground">
            Devices currently signed in to your account. Revoke any you don&apos;t recognize.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading active sessions...
        </div>
      ) : sessions.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No active sessions found.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {s.device || "Unknown device"}
                    {s.current && (
                      <span className="rounded-full bg-positive/10 px-2 py-0.5 text-[11px] font-medium text-positive">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.ip ? `${s.ip} · ` : ""}Last active {timeAgo(s.lastSeenAt)}
                  </p>
                </div>
              </div>
              {!s.current && confirmingRevoke === s.id ? (
                <span className="flex shrink-0 items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Revoke this device?</span>
                  <button
                    onClick={() => revoke(s.id)}
                    disabled={revoking === s.id}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-destructive-solid px-3 text-destructive-foreground hover:bg-destructive-solid/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {revoking === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmingRevoke(null)}
                    disabled={revoking === s.id}
                    className="flex h-9 items-center rounded-lg border border-input px-3 text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => (s.current ? revoke(s.id) : setConfirmingRevoke(s.id))}
                  disabled={revoking === s.id}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-destructive/40 px-3 text-sm text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {revoking === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  {s.current ? "Sign out" : "Revoke"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
