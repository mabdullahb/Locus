import type {
  EnrichmentProviderType,
  EnrichmentResult,
} from "./types";
import { geminiProvider } from "./providers/gemini";
import { anthropicProvider } from "./providers/anthropic";
import { openaiProvider } from "./providers/openai";
import { openrouterProvider } from "./providers/openrouter";
import { nineRouterProvider } from "./providers/nine-router";
import { sanitizeLog } from "./log-sanitizer";
import { getProviderLabel } from "./provider-registry";

const providers = {
  gemini: geminiProvider,
  anthropic: anthropicProvider,
  openai: openaiProvider,
  openrouter: openrouterProvider,
  "9router": nineRouterProvider,
} as const;

export async function enrichLead(
  providerType: EnrichmentProviderType,
  apiKey: string,
  businessName: string,
  contextText: string,
  model?: string,
): Promise<EnrichmentResult> {
  const provider = providers[providerType];
  if (!provider) {
    throw new Error(`Unknown enrichment provider: ${providerType}`);
  }

  try {
    return await provider.enrich(
      { apiKey, provider: providerType, model },
      businessName,
      contextText,
    );
  } catch (err) {
    // Name the provider. A bare "API key expired." gave no hint which of
    // the user's saved keys had expired. The original cause (e.g. a fetch
    // failure's network error) is kept for describeEnrichmentError.
    const error = err as Error & { cause?: unknown };
    throw new Error(`${getProviderLabel(providerType)}: ${error?.message || String(err)}`, { cause: error?.cause });
  }
}

export { sanitizeLog };
