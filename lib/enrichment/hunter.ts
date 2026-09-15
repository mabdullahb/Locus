// Hunter.io's Domain Search API: given a domain, returns emails Hunter
// already has on file for it, ranked by confidence. Unlike the AI providers
// in providers/, this isn't a "given this text, extract an email" step, so
// it doesn't implement the EnrichmentProvider interface, it's a separate,
// optional pre-check tried in hybridEnrichLead before the website-fetch +
// AI-extraction cascade, since a single API call here is cheaper and faster
// than fetching and parsing a whole page.

export interface HunterResult {
  email: string | null;
  confidence: number | null;
}

const HUNTER_TIMEOUT_MS = 10000;

export async function findEmailViaHunter(domain: string, apiKey: string): Promise<HunterResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HUNTER_TIMEOUT_MS);
  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(apiKey)}&limit=5`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Hunter.io domain search failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { data?: { emails?: Array<{ value: string; confidence: number }> } };
    const emails = data.data?.emails || [];
    if (emails.length === 0) return { email: null, confidence: null };
    // Hunter returns emails in no guaranteed order, sort explicitly so the
    // highest-confidence one wins regardless of API response ordering.
    const best = [...emails].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
    return { email: best.value, confidence: typeof best.confidence === "number" ? best.confidence / 100 : null };
  } finally {
    clearTimeout(timeout);
  }
}

// Hunter's domain-search wants a bare hostname ("acme.com"), not a full
// URL. The lead's stored `website` field is whatever the search provider
// returned, usually a full URL, sometimes with a scheme missing entirely.
export function extractDomain(website: string): string | null {
  try {
    const url = new URL(website.includes("://") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}
