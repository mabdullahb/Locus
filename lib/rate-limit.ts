// In-memory sliding-window rate limiter for auth endpoints (login/register).
// Matches the existing pattern in lib/enrichment/rate-limiter.ts. Known
// limitation: counters are per-process, so on a multi-instance serverless
// deployment (e.g. Vercel with concurrent instances) the effective limit is
// this value times the number of warm instances handling requests. Good
// enough for a single-instance/low-concurrency deployment; if this app ever
// scales to many concurrent serverless instances, replace with a
// Redis-backed counter (ioredis is already a dependency) for a truly shared
// limit.

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= config.limit;
}

setInterval(() => {
  const now = Date.now();
  buckets.forEach((v, k) => {
    if (now > v.resetAt) buckets.delete(k);
  });
}, 5 * 60 * 1000).unref();
