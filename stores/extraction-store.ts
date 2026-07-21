"use client";

import { create } from "zustand";

const API_BASE = "/api";

export type PipelineStage =
  | "idle"
  | "initializing"
  | "navigating"
  | "parsing"
  | "enriching"
  | "formatting"
  | "complete"
  | "error"
  | "aborted";

export type ExtractionStatus = "idle" | "running" | "complete" | "error" | "aborted";

interface ExtractionConfig {
  maxResults: number;
  enrichmentDepth: string;
}

interface ExtractionState {
  status: ExtractionStatus;
  stage: PipelineStage;
  progress: number;
  locationsFound: number;
  phonesExtracted: number;
  emailsVerified: number;
  fullyEnriched: number;
  eta: number;
  captchaDetected: boolean;
  errorMessage: string | null;
  config: ExtractionConfig | null;

  startExtraction: (config: ExtractionConfig) => void;
  abortExtraction: () => void;
  retryWithPremiumProxies: () => void;
  dismissComplete: () => void;
  resetExtraction: () => void;
  setStage: (stage: string, progress: number, metrics: Record<string, number>) => void;
  updateMetrics: (metrics: Record<string, number>) => void;
  setComplete: (totalYield: number) => void;
  setError: (message: string) => void;
}

const STAGE_DURATION_MS = 3000;
const CAPTCHA_CHANCE = 0.15;

function simulateStage(
  currentStage: PipelineStage,
  config: ExtractionConfig,
  captchaOverride: boolean | null,
): { stage: PipelineStage; progress: number; metrics: Partial<ExtractionState>; captchaHit: boolean; error: string | null } {
  switch (currentStage) {
    case "idle":
      return {
        stage: "initializing",
        progress: 2,
        metrics: { eta: 45 },
        captchaHit: false,
        error: null,
      };
    case "initializing":
      return {
        stage: "navigating",
        progress: 15,
        metrics: { eta: 38 },
        captchaHit: false,
        error: null,
      };
    case "navigating": {
      const captchaHit = captchaOverride ?? Math.random() < CAPTCHA_CHANCE;
      if (captchaHit) {
        return {
          stage: "error",
          progress: 18,
          metrics: { captchaDetected: true, errorMessage: "CAPTCHA detected — rotating proxies" },
          captchaHit: true,
          error: "CAPTCHA_DETECTED",
        };
      }
      const found = Math.floor(Math.random() * 8) + 3;
      const phones = Math.floor(found * (0.6 + Math.random() * 0.3));
      return {
        stage: "parsing",
        progress: 40,
        metrics: {
          locationsFound: found,
          phonesExtracted: phones,
          eta: 25,
        },
        captchaHit: false,
        error: null,
      };
    }
    case "parsing": {
      const found = Math.floor(Math.random() * 12) + 5;
      const phones = Math.floor(found * (0.7 + Math.random() * 0.25));
      return {
        stage: config.enrichmentDepth !== "basic" ? "enriching" : "formatting",
        progress: config.enrichmentDepth !== "basic" ? 60 : 80,
        metrics: {
          locationsFound: found,
          phonesExtracted: phones,
          eta: config.enrichmentDepth !== "basic" ? 18 : 8,
        },
        captchaHit: false,
        error: null,
      };
    }
    case "enriching": {
      const emails = Math.floor(Math.random() * 6) + 2;
      const enriched = Math.floor(emails * (0.4 + Math.random() * 0.3));
      return {
        stage: "formatting",
        progress: 85,
        metrics: {
          emailsVerified: emails,
          fullyEnriched: enriched,
          eta: 5,
        },
        captchaHit: false,
        error: null,
      };
    }
    case "formatting":
      return {
        stage: "complete",
        progress: 100,
        metrics: { eta: 0, status: "complete" as const },
        captchaHit: false,
        error: null,
      };
    default:
      return {
        stage: currentStage,
        progress: 0,
        metrics: {},
        captchaHit: false,
        error: null,
      };
  }
}

export const useExtractionStore = create<ExtractionState>((set, get) => ({
  status: "idle",
  stage: "idle",
  progress: 0,
  locationsFound: 0,
  phonesExtracted: 0,
  emailsVerified: 0,
  fullyEnriched: 0,
  eta: 0,
  captchaDetected: false,
  errorMessage: null,
  config: null,

  setStage: (stage, progress, metrics) => {
    set((s) => ({
      stage: stage as PipelineStage,
      progress,
      status: "running" as ExtractionStatus,
      locationsFound: s.locationsFound + (metrics.locationsFound ?? 0),
      phonesExtracted: s.phonesExtracted + (metrics.phonesExtracted ?? 0),
      emailsVerified: s.emailsVerified + (metrics.emailsVerified ?? 0),
      fullyEnriched: s.fullyEnriched + (metrics.fullyEnriched ?? 0),
    }));
  },

  updateMetrics: (metrics) => {
    set((s) => ({
      locationsFound: s.locationsFound + (metrics.locationsFound ?? 0),
      phonesExtracted: s.phonesExtracted + (metrics.phonesExtracted ?? 0),
      emailsVerified: s.emailsVerified + (metrics.emailsVerified ?? 0),
      fullyEnriched: s.fullyEnriched + (metrics.fullyEnriched ?? 0),
      progress: metrics.progress ?? s.progress,
    }));
  },

  setComplete: (totalYield) => {
    set({ status: "complete", stage: "complete", progress: 100, eta: 0 });
  },

  setError: (message) => {
    set({ status: "error", stage: "error", errorMessage: message });
  },

  startExtraction: async (config) => {
    set({
      status: "running",
      stage: "initializing",
      progress: 0,
      locationsFound: 0,
      phonesExtracted: 0,
      emailsVerified: 0,
      fullyEnriched: 0,
      eta: 45,
      captchaDetected: false,
      errorMessage: null,
      config,
    });

    try {
      const res = await fetch(`${API_BASE}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sessionId) {
          return;
        }
      }
    } catch {
      // Backend not available — fall back to simulation
    }

    let captchaOverride: boolean | null = null;

    const advance = () => {
      const state = get();
      if (state.status !== "running") return;

      const result = simulateStage(state.stage, config, captchaOverride);
      captchaOverride = null;

      if (result.error === "CAPTCHA_DETECTED") {
        set({
          status: "error",
          stage: result.stage,
          progress: result.progress,
          captchaDetected: true,
          errorMessage: result.metrics.errorMessage ?? null,
        });
        return;
      }

      set({
        stage: result.stage as PipelineStage,
        progress: result.progress,
        eta: result.metrics.eta ?? state.eta,
        locationsFound: state.locationsFound + (result.metrics.locationsFound ?? 0),
        phonesExtracted: state.phonesExtracted + (result.metrics.phonesExtracted ?? 0),
        emailsVerified: state.emailsVerified + (result.metrics.emailsVerified ?? 0),
        fullyEnriched: state.fullyEnriched + (result.metrics.fullyEnriched ?? 0),
      });

      if (result.stage === "complete") {
        set({ status: "complete", eta: 0 });
      } else {
        const nextStage = result.stage as PipelineStage;
        if (nextStage !== "complete") {
          const delay =
            nextStage === "parsing"
              ? STAGE_DURATION_MS + Math.random() * 2000
              : STAGE_DURATION_MS;
          setTimeout(advance, delay);
        }
      }
    };

    setTimeout(advance, 1500);
  },

  abortExtraction: () => {
    set({
      status: "aborted",
      stage: "aborted",
      progress: get().progress,
      eta: 0,
    });
  },

  retryWithPremiumProxies: () => {
    set({
      status: "running",
      stage: "initializing",
      progress: 0,
      captchaDetected: false,
      errorMessage: null,
      eta: 50,
    });

    setTimeout(() => {
      const state = get();
      if (state.status !== "running") return;

      set({
        stage: "navigating",
        progress: 10,
      });

      setTimeout(() => {
        const advance = () => {
          const state = get();
          if (state.status !== "running") return;
          const result = simulateStage(state.stage, state.config ?? { maxResults: 100, enrichmentDepth: "standard" }, false);
          set({
            stage: result.stage as PipelineStage,
            progress: result.progress,
            eta: result.metrics.eta ?? state.eta,
            locationsFound: state.locationsFound + (result.metrics.locationsFound ?? 0),
            phonesExtracted: state.phonesExtracted + (result.metrics.phonesExtracted ?? 0),
            emailsVerified: state.emailsVerified + (result.metrics.emailsVerified ?? 0),
            fullyEnriched: state.fullyEnriched + (result.metrics.fullyEnriched ?? 0),
          });
          if (result.stage === "complete") {
            set({ status: "complete", eta: 0 });
          } else {
            setTimeout(advance, STAGE_DURATION_MS);
          }
        };
        setTimeout(advance, 2000);
      }, 1500);
    }, 1000);
  },

  dismissComplete: () => {
    set({ status: "idle", stage: "idle", progress: 0 });
  },

  resetExtraction: () => {
    set({
      status: "idle",
      stage: "idle",
      progress: 0,
      locationsFound: 0,
      phonesExtracted: 0,
      emailsVerified: 0,
      fullyEnriched: 0,
      eta: 0,
      captchaDetected: false,
      errorMessage: null,
      config: null,
    });
  },

}));
