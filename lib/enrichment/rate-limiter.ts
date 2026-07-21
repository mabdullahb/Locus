const BURST_LIMIT = parseInt(process.env.ENRICHMENT_RATE_LIMIT || "30", 10);

const counters = new Map<string, { count: number; resetAt: number }>();

export async function checkEnrichmentRateLimit(
  userId: string,
): Promise<boolean> {
  const now = Date.now();
  const windowKey = Math.floor(now / 60000);
  const key = `${userId}:${windowKey}`;

  const entry = counters.get(key);
  if (!entry || now > entry.resetAt) {
    counters.set(key, { count: 1, resetAt: now + 90000 });
    return true;
  }

  entry.count++;
  if (entry.count > BURST_LIMIT) return false;
  return true;
}

// Prune stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  counters.forEach((v, k) => {
    if (now > v.resetAt) counters.delete(k);
  });
}, 300000).unref();
