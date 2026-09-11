// Providers signal quota/rate-limit exhaustion in different shapes (HTTP 429,
// "RESOURCE_EXHAUSTED" from Gemini, "insufficient_quota" from OpenAI-style
// APIs, OpenRouter's free-tier daily cap message, etc). This is a best-effort
// classifier used to distinguish "will succeed again once quota resets" from
// other failures (bad key, network error, malformed response) so the UI can
// offer a scoped bulk-retry instead of forcing a full re-extraction.
const RATE_LIMIT_PATTERNS = [
  /rate.?limit/i,
  /429/,
  /quota/i,
  /resource_exhausted/i,
  /too many requests/i,
];

export function isRateLimitError(message: string | null | undefined): boolean {
  if (!message) return false;
  return RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(message));
}

// Node's native fetch() wraps a real connection-level failure (DNS,
// connection refused, reset, TLS) in a generic "fetch failed" TypeError,
// with the actual reason only available on err.cause. Three separate
// enrichment failure paths (the worker, the on-demand single-lead retry
// route, and the bulk retry-failed route) each used to log just
// err.message, throwing that real reason away and leaving "fetch failed"
// as the only visible clue. This pulls the cause back out wherever one
// exists, so the same underlying error, wherever it's raised or caught,
// always surfaces the actual reason.
export function describeEnrichmentError(err: unknown): string {
  const error = err as (Error & { cause?: unknown }) | undefined;
  const baseMessage = error?.message || String(err);
  const cause = error?.cause;
  if (!cause) return baseMessage;
  const causeText = cause instanceof Error ? cause.message : String(cause);
  return `${baseMessage} (cause: ${causeText})`;
}
