import type { EnrichmentProvider, EnrichmentContext, EnrichmentResult } from "../types";
import { sanitizeLog } from "../log-sanitizer";

const EXTRACTION_PROMPT = `Extract business contact information from the content below.

Return ONLY valid JSON with these exact fields (use null for missing):
{
  "email": string | null,
  "phone": string | null,
  "confidence": number | null
}

Confidence: 0-1 rating of how confident you are. 0 = no data, 1 = certain.

Content:
`;

function parseJsonResponse(text: string): Partial<EnrichmentResult> {
  const cleaned = text
    .replace(/```(?:json)?\n?/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const emailMatch = cleaned.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = cleaned.match(
      /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
    );
    return {
      email: emailMatch ? emailMatch[0] : null,
      phone: phoneMatch ? phoneMatch[0] : null,
      confidence: null,
    };
  }
}

interface OpenRouterErrorBody {
  error?: {
    message?: string;
    metadata?: { raw?: string };
  };
}

// body.error.message on a free-model rate limit is a useless constant
// ("Provider returned error") for every kind of upstream failure. The actual
// reason (e.g. "google/gemma-4-26b-a4b-it:free is temporarily rate-limited
// upstream... add your own key to accumulate your rate limits") lives in
// error.metadata.raw, confirmed against a live 429 response. Prefer it.
function extractErrorMessage(body: OpenRouterErrorBody, status: number): string {
  return (
    body?.error?.metadata?.raw ||
    body?.error?.message ||
    `OpenRouter request failed with status ${status}`
  );
}

function callOpenRouter(ctx: EnrichmentContext, businessName: string, contextText: string) {
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      // "openrouter/free" is OpenRouter's own auto-router across whatever
      // free models are currently live. A hardcoded specific free model
      // slug (previously google/gemini-2.0-flash-exp:free) gets silently
      // retired periodically, which is exactly what broke enrichment here
      // ("No endpoints found" from OpenRouter, 100% error rate).
      model: ctx.model || "openrouter/free",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `${EXTRACTION_PROMPT}Business: ${businessName}\n\n${contextText.slice(0, 8000)}`,
        },
      ],
    }),
  });
}

export const openrouterProvider: EnrichmentProvider = {
  name: "openrouter",

  async enrich(
    ctx: EnrichmentContext,
    businessName: string,
    contextText: string,
  ): Promise<EnrichmentResult> {
    let response = await callOpenRouter(ctx, businessName, contextText);
    let body = await response.json();

    // Free models share one rate-limit pool across every OpenRouter user on
    // that model, so a 429 here is routine, not a real failure, and
    // OpenRouter's own error text says to just retry shortly. One retry
    // after a short delay meaningfully improves real-world success on free
    // models without adding latency to the common, non-rate-limited case.
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 4000));
      response = await callOpenRouter(ctx, businessName, contextText);
      body = await response.json();
    }

    if (!response.ok) {
      throw new Error(extractErrorMessage(body, response.status));
    }
    const text = body.choices?.[0]?.message?.content || "";

    const parsed = parseJsonResponse(text);

    return {
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      confidence: parsed.confidence ?? null,
      source: "website",
      rawResponse: sanitizeLog(text.slice(0, 500)),
    };
  },
};
