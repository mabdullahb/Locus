export type EnrichmentProviderType = "gemini" | "anthropic" | "openai";

export interface EnrichmentContext {
  apiKey: string;
  provider: EnrichmentProviderType;
  model?: string;
}

export interface EnrichmentResult {
  email: string | null;
  phone: string | null;
  confidence: number | null;
  source: "website" | "search" | "none";
  rawResponse?: string;
}

export interface EnrichmentProvider {
  name: EnrichmentProviderType;
  enrich(
    ctx: EnrichmentContext,
    businessName: string,
    contextText: string,
  ): Promise<EnrichmentResult>;
}
