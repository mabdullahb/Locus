"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useLeadsStore } from "@/stores/leads-store";

// Owns the Dashboard's leads fetch entirely (both the default "everything"
// view and the filtered-by-session view from History's row click), since
// which one to fetch depends on a URL param only readable here, behind
// Suspense. Two separate effects racing on the same store would risk the
// wrong one winning depending on network timing.
export function SessionFilterBanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewSessionId = searchParams.get("viewSession");
  const replaceLeads = useLeadsStore((s) => s.replaceLeads);
  const setViewingSession = useLeadsStore((s) => s.setViewingSession);
  const viewingSession = useLeadsStore((s) => s.viewingSession);

  useEffect(() => {
    if (!viewSessionId) {
      setViewingSession(null);
      fetch("/api/leads?page=1&pageSize=5000")
        .then((r) => r.json())
        .then((data) => replaceLeads(data.leads || []))
        .catch(() => replaceLeads([]));
      return;
    }

    Promise.all([
      fetch(`/api/history/${viewSessionId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/leads?sessionId=${viewSessionId}&pageSize=5000`).then((r) => r.json()),
    ])
      .then(([session, leadsData]) => {
        replaceLeads(leadsData.leads || []);
        if (session) {
          setViewingSession({ id: viewSessionId, query: session.query, location: session.location });
        }
      })
      .catch(() => replaceLeads([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewSessionId]);

  if (!viewingSession) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm">
      <span className="text-foreground">
        Viewing results for <strong className="font-medium">{viewingSession.query}</strong> in{" "}
        {viewingSession.location}
      </span>
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
        Clear filter, show all leads
      </button>
    </div>
  );
}
