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

  return provider.enrich(
    { apiKey, provider: providerType, model },
    businessName,
    contextText,
  );
}

export { sanitizeLog };
