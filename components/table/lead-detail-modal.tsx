"use client";

import { useState, useEffect } from "react";
import { X, Loader2, AlertCircle, MapPin, Phone, Mail, Globe, Tag, CheckCircle2, XCircle } from "lucide-react";
import { StatusBadge } from "./status-badge";
import type { LeadStatus } from "@/stores/leads-store";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

interface LeadDetail {
  id: string;
  businessName: string;
  location: string;
  phone: string | null;
  email: string | null;
  emailVerified: boolean;
  website: string | null;
  category: string | null;
  status: LeadStatus;
  createdAt: string;
  timesSeen: number;
  lastSeenAt: string;
  searchQuery: string;
  enrichmentLogs: Array<{
    id: string;
    source: string;
    resultStatus: string;
    emailFound: boolean;
    errorMessage: string | null;
    enrichedAt: string;
  }>;
}

export function LeadDetailModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(onClose);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });
    fetch(`/api/leads/${leadId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load lead");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setLead(data);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load lead details");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">Lead Details</h2>
          <button onClick={onClose} aria-label="Close lead details" className="rounded p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : lead ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-foreground">{lead.businessName}</h3>
              <StatusBadge status={lead.status} enriching={false} />
            </div>

            {lead.timesSeen > 1 && (
              <p className="text-xs text-muted-foreground">
                Found in {lead.timesSeen} searches, most recently{" "}
                {new Date(lead.lastSeenAt).toLocaleDateString()}.
              </p>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{lead.location}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <span className="font-mono">{lead.phone || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="font-mono">{lead.email || "—"}</span>
                {lead.email && (
                  lead.emailVerified ? (
                    <span className="flex items-center gap-1 text-xs text-positive">
                      <CheckCircle2 className="h-3 w-3" /> verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <XCircle className="h-3 w-3" /> unverified
                    </span>
                  )
                )}
              </div>
              {lead.website && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-4 w-4 shrink-0" />
                  <a href={lead.website} target="_blank" rel="noopener noreferrer" className="truncate underline hover:text-foreground">
                    {lead.website}
                  </a>
                </div>
              )}
              {lead.category && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Tag className="h-4 w-4 shrink-0" />
                  <span>{lead.category}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Found via search &quot;{lead.searchQuery}&quot; on {new Date(lead.createdAt).toLocaleDateString()}
              </p>
            </div>

            {lead.enrichmentLogs.length > 0 && (
              <div className="border-t border-border pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Enrichment History
                </p>
                <div className="space-y-1.5">
                  {lead.enrichmentLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {log.source} · {new Date(log.enrichedAt).toLocaleString()}
                      </span>
                      <span
                        className={
                          log.resultStatus === "found"
                            ? "text-positive"
                            : log.resultStatus === "error"
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }
                        title={log.errorMessage ?? undefined}
                      >
                        {log.resultStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
