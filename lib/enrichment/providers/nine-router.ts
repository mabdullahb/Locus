import type { EnrichmentProvider, EnrichmentContext, EnrichmentResult } from "../types";
import { sanitizeLog } from "../log-sanitizer";

// Self-hosted OpenAI-compatible router. The base URL is deployment-specific
// (a "http(s)://host:port/v1" endpoint exposing /models and /chat/completions),
// so it comes from NINE_ROUTER_BASE_URL with no default.
//
// The request carries the user's decrypted LLM key in an Authorization header,
// so plain http to a public host is only allowed when NINE_ROUTER_ALLOW_INSECURE_HTTP
// is explicitly set. http to a loopback or private-range host (a router on the
// same machine or LAN) is fine without it. https always works.
function isLocalHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

export function getBaseUrl(): string {
  const base = process.env.NINE_ROUTER_BASE_URL;
  if (!base) {
    throw new Error(
      "9Router is not configured on this deployment. Set NINE_ROUTER_BASE_URL, or use a different provider.",
    );
  }

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new Error("NINE_ROUTER_BASE_URL is not a valid URL.");
  }

  if (url.protocol === "http:") {
    if (!isLocalHost(url.hostname) && process.env.NINE_ROUTER_ALLOW_INSECURE_HTTP !== "true") {
      throw new Error(
        "NINE_ROUTER_BASE_URL uses http to a public host, which sends the API key in the clear. " +
          "Use https, or set NINE_ROUTER_ALLOW_INSECURE_HTTP=true if the router is on a network you trust.",
      );
    }
  } else if (url.protocol !== "https:") {
    throw new Error("NINE_ROUTER_BASE_URL must be an http or https URL.");
  }

  return base.replace(/\/+$/, "");
}

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

export const nineRouterProvider: EnrichmentProvider = {
  name: "9router",

  async enrich(
    ctx: EnrichmentContext,
    businessName: string,
    contextText: string,
  ): Promise<EnrichmentResult> {
    // Unlike the hosted providers, there's no known-good default model to
    // fall back to on a self-hosted router — guessing one risks the exact
    // "silently retired slug, 100% error rate" failure mode already found
    // in the OpenRouter provider. Require it explicit instead.
    //
    // ctx.model is opaque to us either way: it can be a literal model ID,
    // or the name of a 9Router "Combo" (a group of models with a fallback
    // strategy — e.g. "try in order" — configured on the router itself).
    // Locus doesn't need to know which; 9Router resolves it server-side.
    if (!ctx.model) {
      throw new Error("9Router requires a model — set one in Settings > API Keys.");
    }

    const response = await fetch(`${getBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ctx.model,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `${EXTRACTION_PROMPT}Business: ${businessName}\n\n${contextText.slice(0, 8000)}`,
          },
        ],
      }),
    });

    // 9Router mislabels its response Content-Type as text/event-stream even
    // for a normal (non-streaming) request, and appends a trailing SSE
    // terminator — literally "data: [DONE]" with no separating newline —
    // directly after the JSON body. response.json() chokes on that ("Unexpected
    // non-whitespace character after JSON"), even though the JSON itself is
    // well-formed. Confirmed against the live endpoint 2026-07-28. Parse the
    // raw text and strip the terminator before falling back to a hard failure.
    const raw = await response.text();
    let body: { choices?: { message?: { content?: string } }[]; error?: { message?: string } | string };
    try {
      body = JSON.parse(raw);
    } catch {
      try {
        body = JSON.parse(raw.replace(/\s*data:\s*\[DONE\]\s*$/, ""));
      } catch {
        throw new Error(`9Router returned a non-JSON response: ${raw.slice(0, 200)}`);
      }
    }
    if (!response.ok) {
      const errMsg = typeof body?.error === "string" ? body.error : body?.error?.message;
      throw new Error(errMsg || `9Router request failed with status ${response.status}`);
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
