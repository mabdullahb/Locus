import type { EnrichmentProviderType, EnrichmentResult } from "./types";
import { enrichLead } from "./service";
import { checkEnrichmentRateLimit } from "./rate-limiter";
import { assertOutboundUrlAllowed } from "@/lib/security/ssrf-guard";
import { findEmailViaHunter, extractDomain } from "./hunter";

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

// Was hardcoded to SerpApi's endpoint regardless of which business-search
// provider the user actually configured. For Serper.dev or Google Places
// users, that silently sent the wrong-shaped key to the wrong API. The
// request failed, the catch swallowed it, and every lead fell through to
// "not found" with no visible error. This is a real, confirmed contributor
// to low enrichment yield, independent of the sequential/parallel question.
// Neither branch had a timeout of its own. The website fetch a few lines
// down has an explicit AbortController, but this search call relied
// entirely on the outer 60s race in server/index.ts to eventually kill it.
// A single slow response here could silently eat the whole enrichment budget
// with nothing catching it early, making the outer timeout more likely to
// fire even when the LLM call itself would have been fast.
//
// Confirmed live on a real account: with ENRICHMENT_CONCURRENCY=4 all
// hitting SerpApi at once, roughly a third of no-website leads were timing
// out at the previous 10s ceiling ("SerpApi search timed out" in
// enrichmentLog), well within what a real SerpApi/Serper response can take
// under concurrent load, especially on a free/trial plan. 20s gives real
// slow-but-successful responses room to land instead of being thrown away.
const SEARCH_TIMEOUT = 20000;

async function searchBusiness(
  query: string,
  apiKey: string | undefined,
  provider: string | undefined,
): Promise<string> {
  if (!apiKey) return "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT);

  // A non-ok response (wrong/expired key, out of credits, rate limited) used
  // to fall through to a silent "" here, which hybridEnrichLead treats the
  // same as a genuine "no snippets found." That turned a real, actionable
  // provider error into an invisible 0% enrichment rate for the whole batch,
  // every lead logged as a clean "not found" with no error message anywhere.
  // Throwing instead lets it propagate to the caller's real error handling
  // (enrichmentLog.errorMessage, status "failed", visible retry), same as
  // any other enrichment failure.
  try {
    if (provider === "serper") {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Serper search failed (${res.status}): ${body.slice(0, 200)}`);
      }
      const data = await res.json() as { organic?: { snippet?: string }[] };
      return (data.organic || []).map((r) => r.snippet).filter(Boolean).slice(0, 5).join("\n");
    }

    if (provider === "google_places") {
      // Google Places has no general web-search/snippet product to fall
      // back to. It's business-listing data only, so skip rather than call
      // the wrong API with a Places key.
      return "";
    }

    // Default: serpapi (also the historical behavior for unset/unknown provider).
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${apiKey}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`SerpApi search failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = await res.json() as { organic_results?: { snippet?: string }[] };
    return (data.organic_results || []).map((r) => r.snippet).filter(Boolean).slice(0, 5).join("\n");
  } catch (e) {
    // An aborted fetch throws a generic "This operation was aborted" with no
    // indication of why, which then surfaces as the lead's failure reason
    // (enrichmentLog.errorMessage) with no actionable information. The
    // initial-search functions in server/index.ts already translate this
    // into a clear message. This fallback search didn't.
    if ((e as Error).name === "AbortError") {
      throw new Error(`${provider === "serper" ? "Serper.dev" : "SerpApi"} search timed out`);
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function hybridEnrichLead(
  userId: string,
  providerType: EnrichmentProviderType,
  apiKey: string,
  businessName: string,
  website: string | null,
  location: string,
  extractionApiKey?: string,
  model?: string,
  extractionProvider?: string,
  hunterApiKey?: string,
): Promise<EnrichmentResult> {
  const allowed = await checkEnrichmentRateLimit(userId);
  if (!allowed) {
    return { email: null, phone: null, confidence: null, source: "none" };
  }

  // Tried first, before fetching and parsing the site or spending an AI
  // call: Hunter.io already knows about a lot of domains, one cheap API
  // call to Hunter's own servers (not the lead's site, so no SSRF concern
  // here) can skip the rest of the cascade entirely when it has an answer.
  // Optional and additive, only runs at all if the user has a Hunter.io
  // key configured, everyone else's behavior is completely unchanged.
  if (website && hunterApiKey) {
    const domain = extractDomain(website);
    if (domain) {
      try {
        const hunterResult = await findEmailViaHunter(domain, hunterApiKey);
        if (hunterResult.email) {
          return {
            email: hunterResult.email,
            phone: null,
            confidence: hunterResult.confidence,
            source: "website",
            rawResponse: `hunter.io domain search: ${domain}`,
          };
        }
      } catch {
        // Hunter unavailable, rate-limited, or bad key, fall through to the
        // existing website-fetch + AI cascade exactly as if no key were
        // configured at all.
      }
    }
  }

  if (website) {
    try {
      // `website` comes from the search provider's listing data for a
      // business the user searched for, not something the user types
      // directly. Anyone can set a Google Business Profile's website field
      // to an arbitrary host (cloud metadata, an internal service), so it's
      // just as untrusted as a user-supplied URL and needs the same SSRF
      // check as the webhook connector.
      await assertOutboundUrlAllowed(website);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(website, {
        signal: controller.signal,
        // A 3xx to an internal target would otherwise sidestep the check above.
        redirect: "error",
      });
      clearTimeout(timeout);
      if (response.ok) {
        const html = await response.text();
        const text = extractTextFromHtml(html);
        const result = await enrichLead(providerType, apiKey, businessName, text, model);
        if (result.email) return { ...result, source: "website" };
      }
    } catch {
      // Fall through to search
    }
  }

  const searchQuery = `${businessName} ${location} email contact`;
  const snippets = await searchBusiness(searchQuery, extractionApiKey, extractionProvider);
  if (snippets) {
    const result = await enrichLead(providerType, apiKey, businessName, snippets, model);
    if (result.email) return { ...result, source: "search" };
  }

  return { email: null, phone: null, confidence: null, source: "none" };
}
