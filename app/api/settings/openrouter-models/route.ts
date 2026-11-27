import { NextResponse } from "next/server";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";

export interface OpenRouterModelOption {
  id: string;
  name: string;
  isFree: boolean;
  contextLength: number | null;
}

// A handful of well-established models across major vendors, used only when
// OpenRouter's live catalog can't be reached (network issue, OpenRouter down).
// The "custom model ID" field in Settings covers anything not listed here.
// Checked against OpenRouter's live catalog on 2026-11-27. Two earlier
// free entries had been removed from OpenRouter, and the GPT-4o models shut
// down on 2027-01-14, so this list goes stale and needs the same check.
const FALLBACK_MODELS: OpenRouterModelOption[] = [
  { id: "google/gemma-4-31b-it:free", name: "Google: Gemma 4 31B (free)", isFree: true, contextLength: null },
  { id: "google/gemma-4-26b-a4b-it:free", name: "Google: Gemma 4 26B A4B (free)", isFree: true, contextLength: null },
  { id: "nvidia/nemotron-3.5-lightning:free", name: "NVIDIA: Nemotron 3.5 Lightning (free)", isFree: true, contextLength: null },
  { id: "openai/gpt-6-luna", name: "OpenAI: GPT-6 Luna", isFree: false, contextLength: null },
  { id: "anthropic/claude-haiku-5.5", name: "Anthropic: Claude Haiku 5.5", isFree: false, contextLength: null },
  { id: "anthropic/claude-opus-4.8", name: "Anthropic: Claude Opus 4.8", isFree: false, contextLength: null },
  { id: "google/gemini-3.6-flash", name: "Google: Gemini 3.6 Flash", isFree: false, contextLength: null },
  { id: "google/gemini-3.5-flash", name: "Google: Gemini 3.5 Flash", isFree: false, contextLength: null },
  { id: "meta-llama/llama-3.1-8b-instruct", name: "Meta: Llama 3.1 8B Instruct", isFree: false, contextLength: null },
  { id: "mistralai/mistral-small-3.1-24b-instruct", name: "Mistral: Small 3.1 24B Instruct", isFree: false, contextLength: null },
];

const CACHE_TTL_MS = 60 * 60 * 1000;
let cache: { models: OpenRouterModelOption[]; fetchedAt: number } | null = null;

async function fetchLiveModels(): Promise<OpenRouterModelOption[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { signal: controller.signal });
    if (!res.ok) throw new Error(`OpenRouter models request failed with status ${res.status}`);
    const body = await res.json() as {
      data?: Array<{
        id: string;
        name: string;
        context_length?: number;
        pricing?: { prompt?: string; completion?: string };
      }>;
    };
    const models = (body.data || []).map((m) => ({
      id: m.id,
      name: m.name,
      isFree: m.pricing?.prompt === "0" && m.pricing?.completion === "0",
      contextLength: m.context_length ?? null,
    }));
    if (models.length === 0) throw new Error("OpenRouter returned an empty model list");
    return models;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  try {
    await requireUserId();
  } catch {
    return unauthorized();
  }

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ models: cache.models, source: "live" as const, cached: true });
  }

  try {
    const models = await fetchLiveModels();
    cache = { models, fetchedAt: Date.now() };
    return NextResponse.json({ models, source: "live" as const, cached: false });
  } catch (err) {
    console.error("Failed to fetch live OpenRouter model list, using fallback:", (err as Error).message);
    return NextResponse.json({ models: FALLBACK_MODELS, source: "fallback" as const, cached: false });
  }
}
