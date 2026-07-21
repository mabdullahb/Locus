"use client";

import { useExtractionStore, type PipelineStage } from "@/stores/extraction-store";
import { cn } from "@/lib/utils";
import { formatEta } from "@/lib/eta-calculator";
import { AbortMissionButton } from "./abort-mission-button";
import { Loader2 } from "lucide-react";

interface StageDef {
  key: PipelineStage;
  label: string;
}

const stages: StageDef[] = [
  { key: "initializing", label: "Initializing Proxies" },
  { key: "navigating", label: "Navigating Maps DOM" },
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
  const eta = useExtractionStore((s) => s.eta);
  const captchaDetected = useExtractionStore((s) => s.captchaDetected);
  const errorMessage = useExtractionStore((s) => s.errorMessage);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-foreground">
          Extraction Progress
        </h3>
        <span className="text-xs text-muted-foreground">
          ETA {formatEta(eta)}
        </span>
      </div>

      <div className="mb-5 flex flex-col gap-3">
        {stages.map((s, i) => {
          const state = stageState(s.key, stage, status);
          return (
            <div key={s.key} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all",
                  state === "done" && "bg-teal-500/20 text-teal-500",
                  state === "active" && "bg-primary/20 text-primary",
                  (state === "idle") && "bg-muted text-muted-foreground",
                  state === "error" && "bg-red-500/20 text-red-500",
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
                  state === "done" && "text-teal-500 line-through decoration-teal-500/50",
                  state === "active" && "font-medium text-foreground",
                  state === "idle" && "text-muted-foreground",
                  state === "error" && "text-red-500",
                )}
              >
                {s.label}
              </span>
              <div
                className={cn(
                  "ml-auto h-1.5 w-16 rounded-full bg-muted overflow-hidden",
                  state === "idle" && "opacity-30",
                )}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    state === "done" && "w-full bg-teal-500",
                    state === "active" && "bg-primary",
                    state === "idle" && "w-0",
                    state === "error" && "w-full bg-red-500",
                  )}
                  style={
                    state === "active" && stage === s.key
                      ? { width: `${Math.min(100, Math.max(0, (progress - stageIndex(s.key) * 20)))}%` }
                      : undefined
                  }
                />
              </div>
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

      {captchaDetected && errorMessage && (
        <CaptchaRetry />
      )}

      {status === "running" && (
        <div className="flex items-center justify-end gap-3">
          <AbortMissionButton />
        </div>
      )}
    </div>
  );
}

function CaptchaRetry() {
  const retry = useExtractionStore((s) => s.retryWithPremiumProxies);
  const dismiss = useExtractionStore((s) => s.resetExtraction);

  return (
    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
      <p className="mb-2 text-sm font-medium text-amber-600 dark:text-amber-400">
        CAPTCHA Detected
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        Google Maps blocked this request with a CAPTCHA challenge.
        Upgrade to premium residential proxies to bypass.
      </p>
      <div className="flex gap-2">
        <button
          onClick={retry}
          className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Retry with Premium Proxies
        </button>
        <button
          onClick={dismiss}
          className="rounded-lg border border-border bg-background px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
