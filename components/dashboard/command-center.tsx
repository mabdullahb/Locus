"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, MapPin, Loader2, CheckCircle2, Upload } from "lucide-react";
import { useExtractionStore } from "@/stores/extraction-store";
import { parseRerunParams } from "@/lib/rerun-params";
import { BulkSearchModal } from "./bulk-search-modal";

interface FormState {
  keyword: string;
  location: string;
  radius: string;
  // AI Enrichment depth (basic/standard/full) and Concurrency were exposed
  // as Advanced settings but never actually branched any real behavior:
  // enrichment always runs the same full logic regardless of "depth", and
  // concurrency wasn't even sent to the backend at all, the server always
  // used its own hardcoded worker pool size. Both dropdowns, and Language
  // (removed earlier for the same reason: no effect on results), were
  // decorative. This field stays only so History's config snapshot has a
  // consistent value to display, not because the app branches on it.
  enrichmentDepth: string;
  locale: string;
}

const defaultForm: FormState = {
  keyword: "",
  location: "",
  radius: "10",
  enrichmentDepth: "standard",
  locale: "en-US",
};

export function CommandCenter() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [bulkOpen, setBulkOpen] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  const storeStatus = useExtractionStore((s) => s.status);
  const lastConfig = useExtractionStore((s) => s.config);
  const startExtraction = useExtractionStore((s) => s.startExtraction);
  const dismissComplete = useExtractionStore((s) => s.dismissComplete);

  const isRunning = storeStatus === "running";
  const isComplete = storeStatus === "complete";
  const isError = storeStatus === "error";
  const isAborted = storeStatus === "aborted";
  const isDisabled =
    storeStatus !== "idle" && storeStatus !== "complete" && storeStatus !== "error" && storeStatus !== "aborted";

  const updateForm = (key: keyof FormState, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleStart = () => {
    if (!form.keyword.trim() || !form.location.trim()) return;
    startExtraction({
      keyword: form.keyword,
      location: form.location,
      enrichmentDepth: form.enrichmentDepth,
      radius: form.radius,
      locale: form.locale,
    });
  };

  // After a run completes, dropping straight back to "Start Extraction"
  // with the just-used keyword/location still filled in made it look like
  // nothing happened when clicked. Reset the form for a clean new search
  // and refocus the keyword field instead.
  const handleStartNew = () => {
    dismissComplete();
    setForm(defaultForm);
    requestAnimationFrame(() => {
      document.getElementById("extraction-keyword")?.focus();
    });
  };

  // The button reuses one slot for two different jobs once a run is
  // complete/aborted: "dismiss this result and give me a clean form" vs. "I
  // already typed my next search, just run it." A user who typed a new
  // keyword/location straight into the still-filled-in form, without a
  // separate dismiss step first, had that input silently wiped by
  // handleStartNew instead of run. The fields went blank, the leads table
  // went back to "No leads yet", and nothing else on screen explained why.
  const formMatchesLastRun =
    !!lastConfig && form.keyword === lastConfig.keyword && form.location === lastConfig.location;
  const shouldDismissOnly =
    (isComplete || isAborted) &&
    (formMatchesLastRun || !form.keyword.trim() || !form.location.trim());

  const handleBeginClick = () => {
    if (shouldDismissOnly) {
      handleStartNew();
    } else {
      handleStart();
    }
  };

  // The History panel/page's "Re-run" hands off a past session's config via
  // URL query params (?rerunKeyword=...&rerunLocation=...&rerunDepth=...)
  // rather than in-memory client state — Next.js falls back to a full
  // browser navigation whenever a client-side route transition's RSC fetch
  // fails (flaky network, dev server mid-recompile), which would silently
  // wipe a Zustand-store hand-off and turn "Re-run" into "does nothing."
  // Query params survive any navigation type.
  useEffect(() => {
    const rerun = parseRerunParams(searchParams);
    if (!rerun) return;
    // Strip the query params immediately so a page refresh doesn't
    // re-trigger the same extraction again.
    router.replace("/dashboard");
    if (isDisabled) return;
    queueMicrotask(() => {
      setForm((prev) => ({ ...prev, ...rerun }));
    });
    if (isComplete) {
      dismissComplete();
    }
    startExtraction(rerun);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const buttonContent = () => {
    if (isRunning) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Surveying
        </>
      );
    }
    if ((isComplete || isAborted) && shouldDismissOnly) {
      return (
        <>
          <CheckCircle2 className="h-4 w-4" />
          Begin new survey
        </>
      );
    }
    if (isError) {
      return (
        <>
          <Loader2 className="h-4 w-4" />
          Retry survey
        </>
      );
    }
    return <>Begin survey</>;
  };

  return (
    <section>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-4 rounded-md border border-border bg-card px-6 py-6 text-[16px] leading-loose text-muted-foreground">
          <span>Find</span>
          <span className="relative inline-flex min-w-0 flex-1 basis-[240px] items-center">
            <Search className="pointer-events-none absolute left-0 h-4 w-4 text-muted-foreground/70" />
            <input
              id="extraction-keyword"
              type="text"
              aria-label="What to search for"
              value={form.keyword}
              onChange={(e) => updateForm("keyword", e.target.value)}
              placeholder="software agencies"
              className="w-full border-b border-dotted border-muted-foreground/50 bg-transparent px-1 pb-1 pl-6 font-mono text-[14px] text-foreground-strong placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
            />
          </span>
          <span>in</span>
          <span className="relative inline-flex min-w-0 flex-1 basis-[200px] items-center">
            <MapPin className="pointer-events-none absolute left-0 h-4 w-4 text-muted-foreground/70" />
            <input
              type="text"
              aria-label="Where to search"
              value={form.location}
              onChange={(e) => updateForm("location", e.target.value)}
              placeholder="Hyderabad"
              className="w-full border-b border-dotted border-muted-foreground/50 bg-transparent px-1 pb-1 pl-6 font-mono text-[14px] text-foreground-strong placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
            />
          </span>
          <span>within</span>
          <select
            value={form.radius}
            onChange={(e) => updateForm("radius", e.target.value)}
            aria-label="Search radius"
            className="border-b border-dotted border-muted-foreground/50 bg-transparent px-1 pb-1 font-mono text-[14px] text-foreground-strong focus:border-primary focus:outline-none [&>option]:bg-popover [&>option]:text-popover-foreground"
          >
            <option value="1">1 km</option>
            <option value="5">5 km</option>
            <option value="10">10 km</option>
            <option value="25">25 km</option>
            <option value="50">50 km</option>
            <option value="100">100 km</option>
            <option value="unlimited">no limit</option>
          </select>

          <div className="ml-auto flex items-center gap-2.5">
            <button
              onClick={handleBeginClick}
              disabled={!(isComplete || isAborted) && (isDisabled || !form.keyword.trim() || !form.location.trim())}
              className="flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-5 text-[12.5px] font-medium text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {buttonContent()}
            </button>
          </div>
        </div>

        <button
          onClick={() => setBulkOpen(true)}
          className="flex items-center gap-1.5 self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Upload className="h-3.5 w-3.5" />
          Bulk search from a CSV
        </button>
      </div>

      {bulkOpen && <BulkSearchModal radius={form.radius} onClose={() => setBulkOpen(false)} />}
    </section>
  );
}
