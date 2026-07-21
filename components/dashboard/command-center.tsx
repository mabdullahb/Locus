"use client";

import { useState } from "react";
import { Search, MapPin, SlidersHorizontal, Loader2, Save, CheckCircle2 } from "lucide-react";
import { AdvancedPanel } from "./advanced-panel";
import { CreditEstimator } from "./credit-estimator";
import { useExtractionStore } from "@/stores/extraction-store";

interface FormState {
  keyword: string;
  location: string;
  radius: string;
  concurrency: number;
  proxyType: string;
  enrichmentDepth: string;
  maxResults: number;
  locale: string;
  renderDelay: number;
}

const defaultForm: FormState = {
  keyword: "",
  location: "",
  radius: "10",
  concurrency: 4,
  proxyType: "datacenter",
  enrichmentDepth: "standard",
  maxResults: 100,
  locale: "en-IN",
  renderDelay: 500,
};

export function CommandCenter() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const storeStatus = useExtractionStore((s) => s.status);
  const startExtraction = useExtractionStore((s) => s.startExtraction);
  const dismissComplete = useExtractionStore((s) => s.dismissComplete);

  const isRunning = storeStatus === "running";
  const isComplete = storeStatus === "complete";
  const isError = storeStatus === "error";
  const isDisabled = storeStatus !== "idle" && storeStatus !== "complete" && storeStatus !== "error";

  const updateForm = (key: keyof FormState, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleStart = () => {
    if (!form.keyword.trim() || !form.location.trim()) return;
    if (isComplete) {
      dismissComplete();
    } else {
      startExtraction({
        maxResults: form.maxResults,
        enrichmentDepth: form.enrichmentDepth,
      });
    }
  };

  const buttonContent = () => {
    if (isRunning) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Extracting...
        </>
      );
    }
    if (isComplete) {
      return (
        <>
          <CheckCircle2 className="h-4 w-4" />
          Extraction Complete
        </>
      );
    }
    if (isError) {
      return (
        <>
          <Loader2 className="h-4 w-4" />
          Retry Extraction
        </>
      );
    }
    return (
      <>
        <Loader2 className="h-4 w-4 opacity-0" />
        Start Extraction
      </>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Extraction Command Center
        </h2>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Save className="h-3.5 w-3.5" />
          Save Config
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={form.keyword}
              onChange={(e) => updateForm("keyword", e.target.value)}
              placeholder='e.g. "Software Agencies in Hyderabad"'
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={form.location}
              onChange={(e) => updateForm("location", e.target.value)}
              placeholder="Location (city, area, pincode)"
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={form.radius}
              onChange={(e) => updateForm("radius", e.target.value)}
              className="h-10 w-28 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="25">25 km</option>
              <option value="50">50 km</option>
              <option value="100">100 km</option>
              <option value="unlimited">Unlimited</option>
            </select>

            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm transition-colors ${
                showAdvanced
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background text-muted-foreground hover:bg-muted"
              }`}
              title="Advanced settings"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            <button
              onClick={handleStart}
              disabled={isDisabled || !form.keyword.trim() || !form.location.trim()}
              className="flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {buttonContent()}
            </button>
          </div>
        </div>

        {showAdvanced && (
          <AdvancedPanel
            config={{
              concurrency: form.concurrency,
              proxyType: form.proxyType,
              enrichmentDepth: form.enrichmentDepth,
              maxResults: form.maxResults,
              locale: form.locale,
              renderDelay: form.renderDelay,
            }}
            onChange={(cfg) => {
              setForm((prev) => ({ ...prev, ...cfg }));
            }}
          />
        )}

        <CreditEstimator
          maxResults={form.maxResults}
          enrichmentDepth={form.enrichmentDepth}
          concurrency={form.concurrency}
        />
      </div>
    </div>
  );
}
