// This BYOK app doesn't front the LLM/search API cost (the user's own key
// does), so this limiter isn't protecting Locus's wallet — it exists to stop
// a single session from silently hammering the user's own provider faster
// than they'd want. Previously it fell back to a fake "not found" result
// when tripped (indistinguishable from a real miss in enrichment history)
// and ignored ENRICHMENT_RATE_WINDOW entirely (dead config — the window was
// hardcoded to a 60s wall-clock bucket regardless of what was configured).
const BURST_LIMIT = parseInt(process.env.ENRICHMENT_RATE_LIMIT || "100", 10);
const WINDOW_MS = (parseInt(process.env.ENRICHMENT_RATE_WINDOW || "60", 10)) * 1000;

const counters = new Map<string, { count: number; resetAt: number }>();

export async function checkEnrichmentRateLimit(
  userId: string,
): Promise<boolean> {
  const now = Date.now();
  const entry = counters.get(userId);

  if (!entry || now > entry.resetAt) {
    counters.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  entry.count++;
  return entry.count <= BURST_LIMIT;
}

// Prune stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  counters.forEach((v, k) => {
    if (now > v.resetAt) counters.delete(k);
  });
}, 300000).unref();
