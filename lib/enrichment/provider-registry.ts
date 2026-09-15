export type ProviderCategory = "ai-enrichment" | "business-search" | "email-finder";

export interface ProviderInfo {
  value: string;
  label: string;
  category: ProviderCategory;
  description: string;
  // Restricted to User.isAdmin accounts — a provider still under test, not
  // yet something we want regular users picking. Enforced server-side in
  // /api/settings/ai-key; the client-side option list is just a UX nicety.
  adminOnly?: boolean;
}

export const ALL_PROVIDERS: ProviderInfo[] = [
  { value: "serpapi", label: "SerpApi", category: "business-search", description: "Search results and local business data from Google Maps" },
  { value: "google_places", label: "Google Maps Places API", category: "business-search", description: "Place data directly from Google's Places API" },
  { value: "serper", label: "Serper.dev", category: "business-search", description: "Google Search API with local business and places data" },
  { value: "gemini", label: "Gemini (Google)", category: "ai-enrichment", description: "AI-powered email extraction from business websites" },
  { value: "anthropic", label: "Claude (Anthropic)", category: "ai-enrichment", description: "AI-powered email extraction from business websites" },
  { value: "openai", label: "OpenAI", category: "ai-enrichment", description: "AI-powered email extraction from business websites" },
  { value: "openrouter", label: "OpenRouter", category: "ai-enrichment", description: "Access Gemini, Claude, and other models through OpenRouter's unified API and routing" },
  { value: "9router", label: "9Router", category: "ai-enrichment", description: "Self-hosted OpenAI-compatible model router", adminOnly: true },
  // Optional and additive, not a replacement for the AI providers above.
  // Tried first, cheaper and faster than fetching a site when it has an
  // answer, and falls through to the normal website+AI cascade when it
  // doesn't. Its own category rather than lumped into ai-enrichment, since
  // it isn't mutually exclusive with whichever AI provider is active.
  { value: "hunter", label: "Hunter.io", category: "email-finder", description: "Looks up known email addresses for a business's domain before falling back to AI extraction" },
];

export function getProviderInfo(value: string): ProviderInfo | undefined {
  return ALL_PROVIDERS.find((p) => p.value === value);
}

export function getProvidersByCategory(category: ProviderCategory): ProviderInfo[] {
  return ALL_PROVIDERS.filter((p) => p.category === category);
}

export function getAllProviderValues(): string[] {
  return ALL_PROVIDERS.map((p) => p.value);
}

export function getAIProviderValues(): string[] {
  return getProvidersByCategory("ai-enrichment").map((p) => p.value);
}

export function getBusinessSearchValues(): string[] {
  return getProvidersByCategory("business-search").map((p) => p.value);
}

export function getProviderLabel(value: string): string {
  return ALL_PROVIDERS.find((p) => p.value === value)?.label ?? value;
}

export function getProviderCategory(value: string): ProviderCategory | null {
  return ALL_PROVIDERS.find((p) => p.value === value)?.category ?? null;
}
