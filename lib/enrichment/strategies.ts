import type { EnrichmentProviderType, EnrichmentResult } from "./types";
import { enrichLead } from "./service";
import { checkEnrichmentRateLimit } from "./rate-limiter";

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

async function searchBusiness(query: string): Promise<string> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return "";
  try {
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json() as { organic_results?: { snippet?: string }[] };
    const snippets = (data.organic_results || [])
      .map((r) => r.snippet)
      .filter(Boolean)
      .slice(0, 5);
    return snippets.join("\n");
  } catch {
    return "";
  }
}

export async function hybridEnrichLead(
  userId: string,
  providerType: EnrichmentProviderType,
  apiKey: string,
  businessName: string,
  website: string | null,
  location: string,
): Promise<EnrichmentResult> {
  const allowed = await checkEnrichmentRateLimit(userId);
  if (!allowed) {
    return { email: null, phone: null, confidence: null, source: "none" };
  }

  if (website) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(website, { signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok) {
        const html = await response.text();
        const text = extractTextFromHtml(html);
        const result = await enrichLead(providerType, apiKey, businessName, text);
        if (result.email) return { ...result, source: "website" };
      }
    } catch {
      // Fall through to search
    }
  }

  const searchQuery = `${businessName} ${location} email contact`;
  const snippets = await searchBusiness(searchQuery);
  if (snippets) {
    const result = await enrichLead(providerType, apiKey, businessName, snippets);
    if (result.email) return { ...result, source: "search" };
  }

  return { email: null, phone: null, confidence: null, source: "none" };
}
