"use client";

import { useExtractionStore, type PipelineStage } from "@/stores/extraction-store";
import { cn } from "@/lib/utils";
import { AbortMissionButton } from "./abort-mission-button";
import { AlertCircle, Loader2, PlusCircle } from "lucide-react";

interface StageDef {
  key: PipelineStage;
  label: string;
}

// "initializing"/"navigating" used to be labeled "Initializing Proxies" /
// "Navigating Maps DOM" — leftover copy from an earlier version of this app
// that did real Playwright browser-scraping of Google Maps directly. Neither
// claim is true anymore for any current provider (SerpApi, Google Places,
// Serper.dev are all plain API calls — see the Proxy Management page, which
// already says proxy handling isn't applicable). Relabeled to not claim
// specific work that isn't happening.
const stages: StageDef[] = [
  { key: "initializing", label: "Starting Extraction" },
  { key: "navigating", label: "Searching for Businesses" },
  { key: "parsing", label: "Parsing Listings" },
  { key: "enriching", label: "Email/Phone Enrichment" },
  { key: "formatting", label: "Formatting Dataset" },
];

function stageState(
  stageKey: PipelineStage,
  currentStage: PipelineStage,
  status: string,
): "idle" | "active" | "done" | "error" {
  if (status === "aborted" && stageIndex(stageKey) <= stageIndex(currentStage)) return "error";
  if (status === "error" && stageKey === currentStage) return "error";
  if (stageIndex(stageKey) < stageIndex(currentStage)) return "done";
  if (stageKey === currentStage) return "active";
  return "idle";
}

function stageIndex(s: PipelineStage): number {
  const idx = stages.findIndex((st) => st.key === s);
  return idx >= 0 ? idx : stages.length;
}

export function ProgressPipeline() {
  const stage = useExtractionStore((s) => s.stage);
  const status = useExtractionStore((s) => s.status);
  const progress = useExtractionStore((s) => s.progress);
  const errorMessage = useExtractionStore((s) => s.errorMessage);
  const hasMore = useExtractionStore((s) => s.hasMore);
  const loadingMore = useExtractionStore((s) => s.loadingMore);
  const loadMore = useExtractionStore((s) => s.loadMore);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-foreground">
          Extraction Progress
        </h3>
      </div>

      <div className="mb-5 flex flex-col gap-3">
        {stages.map((s, i) => {
          const state = stageState(s.key, stage, status);
          return (
            <div key={s.key} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all",
                  state === "done" && "bg-primary/15 text-primary",
                  state === "active" && "bg-primary/20 text-primary",
                  (state === "idle") && "bg-muted text-muted-foreground",
                  state === "error" && "bg-destructive/15 text-destructive",
                )}
              >
                {state === "done" ? (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 6l2.5 2.5 4.5-5" />
                  </svg>
                ) : state === "active" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : state === "error" ? (
                  <span>!</span>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-sm transition-colors",
                  state === "done" && "text-primary line-through decoration-primary/50",
                  state === "active" && "font-medium text-foreground",
                  state === "idle" && "text-muted-foreground",
                  state === "error" && "text-destructive",
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {status === "aborted" && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Extraction cancelled. Any leads already found were saved.</p>
        </div>
      )}

      {status === "error" && errorMessage && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {status === "running" && (
        <div className="flex items-center justify-end gap-3">
          <AbortMissionButton />
        </div>
      )}

      {status === "complete" && hasMore && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            This provider has more results for this search.
          </p>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlusCircle className="h-3.5 w-3.5" />
            )}
            Load 100 more
          </button>
        </div>
      )}
    </div>
  );
}
