"use client";

import { useEffect, useState } from "react";
import { useExtractionStore } from "@/stores/extraction-store";

const STAT_CONFIG = [
  { label: "Leads scraped", key: "monthlyLeadsFound" as const, note: (v: Record<string, number>) => `${v.monthlyExtractions ?? 0} extractions` },
  { label: "Emails verified", key: "monthlyEmailsVerified" as const, note: (v: Record<string, number>) => (v.monthlyLeadsFound ? `${Math.round(((v.monthlyEmailsVerified ?? 0) / v.monthlyLeadsFound) * 100)}% of leads` : "") },
  { label: "Phone numbers", key: "monthlyPhoneCount" as const, note: (v: Record<string, number>) => (v.monthlyLeadsFound ? `${Math.round(((v.monthlyPhoneCount ?? 0) / v.monthlyLeadsFound) * 100)}% of leads` : "") },
  { label: "Enrichment runs", key: "monthlyEnrichmentRuns" as const, note: () => "this month" },
];

function AnimatedCount({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) {
      queueMicrotask(() => setCount(0));
      return;
    }
    const steps = 22;
    const inc = target / steps;
    let cur = 0;
    const t = setInterval(() => {
      cur += inc;
      if (cur >= target) { setCount(target); clearInterval(t); }
      else setCount(Math.floor(cur));
    }, 700 / steps);
    return () => clearInterval(t);
  }, [target]);
  return <>{count.toLocaleString()}</>;
}

export function StatsRow() {
  const [values, setValues] = useState<Record<string, number>>({});
  // This month's totals only change once an extraction or enrichment run
  // actually finishes, but the row fetched once on mount and never again,
  // so a run completed during the current visit looked like it hadn't
  // counted until the user refreshed the page. Re-fetching on every
  // extraction status change (including the transient ones) is simpler
  // and cheap enough than trying to catch only "complete".
  const status = useExtractionStore((s) => s.status);

  useEffect(() => {
    fetch("/api/analytics/trends")
      .then((r) => r.json())
      .catch(() => ({}))
      .then((trends) => {
        setValues({
          monthlyLeadsFound: trends.monthlyLeadsFound ?? 0,
          monthlyEmailsVerified: trends.monthlyEmailsVerified ?? 0,
          monthlyPhoneCount: trends.monthlyPhoneCount ?? 0,
          monthlyEnrichmentRuns: trends.monthlyEnrichmentRuns ?? 0,
          monthlyExtractions: trends.monthlyExtractions ?? 0,
        });
      });
  }, [status]);

  return (
    <section>
      <p className="mb-4 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground/90">
        This month
      </p>
      <div className="grid grid-cols-2 border-y border-border sm:grid-cols-4">
        {STAT_CONFIG.map((item, i) => (
          <div
            key={item.label}
            className={[
              "px-5 py-6",
              i > 0 && "border-l border-border",
              i === 2 && "border-l-0 sm:border-l",
              i >= 2 && "border-t border-border sm:border-t-0",
            ].filter(Boolean).join(" ")}
          >
            <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">{item.label}</p>
            <p className="mt-2.5 font-mono text-[28px] font-medium leading-none tracking-[-0.01em] tabular-nums text-foreground-strong">
              <AnimatedCount target={values[item.key] ?? 0} />
            </p>
            <p className="mt-2 font-mono text-[10.5px] tracking-wide text-muted-foreground/90">
              {item.note(values)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
