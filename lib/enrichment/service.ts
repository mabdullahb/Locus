import type {
  EnrichmentProviderType,
  EnrichmentResult,
} from "./types";
import { geminiProvider } from "./providers/gemini";
import { anthropicProvider } from "./providers/anthropic";
import { openaiProvider } from "./providers/openai";
import { sanitizeLog } from "./log-sanitizer";

const providers = {
  gemini: geminiProvider,
  anthropic: anthropicProvider,
  openai: openaiProvider,
} as const;

export function getAvailableProviders(): EnrichmentProviderType[] {
  return Object.keys(providers) as EnrichmentProviderType[];
}

export async function enrichLead(
  providerType: EnrichmentProviderType,
  apiKey: string,
  businessName: string,
  contextText: string,
): Promise<EnrichmentResult> {
  const provider = providers[providerType];
  if (!provider) {
    throw new Error(`Unknown enrichment provider: ${providerType}`);
  }

  return provider.enrich(
    { apiKey, provider: providerType },
    businessName,
    contextText,
  );
}

export { sanitizeLog };
