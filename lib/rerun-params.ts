// Carries a "re-run this past session" request from the History panel/page
// to the Command Center via URL query params rather than in-memory client
// state (a Zustand store field). Next.js falls back to a full browser
// navigation whenever a client-side route transition's RSC fetch fails
// (flaky network, dev server mid-recompile) — that wipes any in-memory
// state, silently turning "Re-run" into "does nothing." Query params
// survive any navigation type, hard or soft.

export interface RerunConfig {
  keyword: string;
  location: string;
  enrichmentDepth: string;
  radius: string;
  locale: string;
}

export function buildRerunUrl(config: RerunConfig): string {
  const params = new URLSearchParams({
    rerunKeyword: config.keyword,
    rerunLocation: config.location,
    rerunDepth: config.enrichmentDepth,
    rerunRadius: config.radius,
    rerunLocale: config.locale,
  });
  return `/dashboard?${params.toString()}`;
}

export function parseRerunParams(searchParams: URLSearchParams): RerunConfig | null {
  const keyword = searchParams.get("rerunKeyword");
  const location = searchParams.get("rerunLocation");
  if (!keyword || !location) return null;
  return {
    keyword,
    location,
    enrichmentDepth: searchParams.get("rerunDepth") || "standard",
    radius: searchParams.get("rerunRadius") || "10",
    locale: searchParams.get("rerunLocale") || "en-US",
  };
}
