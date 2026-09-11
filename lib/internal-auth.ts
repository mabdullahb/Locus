import crypto from "crypto";

// Shared secret between the Next.js app and the Express extraction worker.
// The worker's /api/scrape/* endpoints act on a userId taken from the request
// body, so without this check anyone able to reach the worker port could
// queue jobs that spend another user's search and enrichment API credits.

export function getInternalSecret(): string | null {
  return process.env.INTERNAL_API_SECRET || null;
}

export function internalSecretHeaders(): Record<string, string> {
  const secret = getInternalSecret();
  return secret ? { "x-internal-secret": secret } : {};
}

export function verifyInternalSecret(provided: string | null | undefined): boolean {
  const expected = getInternalSecret();
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
