"use client";

import { MapPin, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { AnimatedCount } from "@/components/ui/animated-count";
import { cn } from "@/lib/utils";
import { useExtractionStore } from "@/stores/extraction-store";

const metrics = [
  { label: "Locations Found", key: "locationsFound" as const, icon: MapPin },
  { label: "Phones Extracted", key: "phonesExtracted" as const, icon: Phone },
  { label: "Emails Verified", key: "emailsVerified" as const, icon: ShieldCheck },
  { label: "Fully Enriched", key: "fullyEnriched" as const, icon: Sparkles },
];

export function LiveMetricsRow() {
  const status = useExtractionStore((s) => s.status);
  const locationsFound = useExtractionStore((s) => s.locationsFound);
  const phonesExtracted = useExtractionStore((s) => s.phonesExtracted);
  const emailsVerified = useExtractionStore((s) => s.emailsVerified);
  const fullyEnriched = useExtractionStore((s) => s.fullyEnriched);

  if (status === "idle") return null;

  const values = { locationsFound, phonesExtracted, emailsVerified, fullyEnriched };

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div
            key={m.key}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{m.label}</span>
            </div>
            <span
              className={cn(
                "font-display text-3xl font-semibold",
                status === "running" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              <span><AnimatedCount target={values[m.key]} /></span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
