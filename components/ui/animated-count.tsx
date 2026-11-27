"use client";

import { useEffect, useState } from "react";

/**
 * Counts up from 0 to `target` over `durationMs`. Shared by the dashboard's
 * "This month" stats and the live extraction metrics.
 *
 * A zero target renders 0 directly instead of going through state. The live
 * metrics row used to have its own copy that returned early on 0 without
 * touching state, so a counter that went 26 -> 0 (a new run starting, or a
 * run that genuinely found nothing) kept showing 26.
 */
export function AnimatedCount({ target, durationMs = 400, steps = 10 }: { target: number; durationMs?: number; steps?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target === 0) return;
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
    }, durationMs / steps);
    return () => clearInterval(timer);
  }, [target, durationMs, steps]);

  return <>{(target === 0 ? 0 : count).toLocaleString()}</>;
}
