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

export const anthropicProvider: EnrichmentProvider = {
  name: "anthropic",

  async enrich(
    ctx: EnrichmentContext,
    businessName: string,
    contextText: string,
  ): Promise<EnrichmentResult> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ctx.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ctx.model || "claude-3-haiku-20240307",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `${EXTRACTION_PROMPT}Business: ${businessName}\n\n${contextText.slice(0, 8000)}`,
          },
        ],
      }),
    });

    const body = await response.json();
    const text = body.content?.[0]?.text || "";

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
