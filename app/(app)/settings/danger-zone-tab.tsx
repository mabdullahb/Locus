"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { AlertTriangle, Trash2, Loader2, AlertCircle } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";

export function DangerZoneTab({ email }: { email: string }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: confirmText, password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete account");
      }
      signOut({ callbackUrl: "/" });
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6">
      <div className="mb-5 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <div>
          <h2 className="font-display text-lg font-semibold text-destructive">Danger Zone</h2>
          <p className="text-xs text-destructive">Irreversible account actions.</p>
        </div>
      </div>

      {error && (
        // [3%], not the usual /5 fix: this banner is nested inside the
        // section's own outer bg-destructive/10 wrapper above, so the tint
        // compounds, and real double-blend math showed /5 alone (4.45)
        // still isn't enough once the outer tint is already in the
        // background, needs the bracket form since plain /3 isn't in
        // Tailwind's default opacity scale and silently generates no rule
        // at all (confirmed live: renders fully transparent, not a 3% tint).
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/[3%] px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="rounded-lg border border-destructive/40 bg-background p-4">
        <p className="text-sm font-medium text-foreground">Delete account</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Permanently deletes your account, all extraction sessions, leads, enrichment history,
          and API keys. This cannot be undone.
        </p>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="mt-3 flex h-9 items-center gap-1.5 rounded-lg border border-destructive/40 px-3 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete my account
          </button>
        ) : (
          <div className="mt-3 space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              This is permanent. Type <span className="font-mono font-semibold">{email}</span> to
              confirm.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={email}
              className="h-9 w-full rounded-lg border border-destructive/40 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-destructive focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Current password"
              className="h-9 w-full rounded-lg border border-destructive/40 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-destructive focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting || confirmText.trim().toLowerCase() !== email.toLowerCase() || !password}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-destructive-solid px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive-solid/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Permanently delete
              </button>
              <button
                onClick={() => {
                  setConfirming(false);
                  setConfirmText("");
                  setError(null);
                }}
                disabled={deleting}
                className="flex h-9 items-center rounded-lg border border-input bg-background px-4 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
