"use client";

import { useEffect, useState } from "react";
import { Database, ShieldCheck, Phone, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const stats = [
  { label: "Total Leads Scraped", value: 247, icon: Database },
  { label: "Emails Verified", value: 183, icon: ShieldCheck },
  { label: "Phone Numbers", value: 215, icon: Phone },
  { label: "Active Sessions", value: 3, icon: Activity },
];

function AnimatedCount({ target, prefix = "" }: { target: number; prefix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target === 0) return;
    const duration = 800;
    const steps = 20;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);

  return (
    <span>
      {prefix}
      {count.toLocaleString()}
    </span>
  );
}

export function StatsRow() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 transition-all hover:shadow-sm"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{stat.label}</span>
            </div>
            <span
              className={cn(
                "font-display text-3xl font-semibold text-foreground",
                "animate-slide-up",
              )}
            >
              <AnimatedCount target={stat.value} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
