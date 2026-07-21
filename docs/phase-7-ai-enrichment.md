# Phase 7 — AI Enrichment

## Goal

Augment scraped business leads with email/phone contact data using LLM, via a provider-agnostic service that supports Gemini, Claude, and OpenAI as interchangeable backends.

## Architecture

```
Worker (server/index.ts)
  │
  ├─ "enriching" stage fires after SerpApi results
  │
  ├─ enrichment.service.ts  (provider-agnostic router)
  │   ├─ gemini.provider.ts   (default — Gemini 2.5 Flash)
  │   ├─ anthropic.provider.ts
  │   └─ openai.provider.ts
  │
  ├─ per-lead strategy: website → LLM → email found?
  │   ├─ YES → write EnrichmentLog, update BusinessLead
  │   └─ NO  → search fallback → LLM → write EnrichmentLog
  │
  ├─ WebSocket broadcasts per-lead progress
  └─ Rate limiter (Redis-based, per-user burst cap)
```

## Data Model Changes

Add `UserApiKey` model to `schema.prisma`:

```prisma
model UserApiKey {
  id           String   @id @default(cuid())
  userId       String
  provider     String   // "gemini" | "openai" | "anthropic"
  encryptedKey String   // AES-256-GCM encrypted
  keyPrefix    String   // first 8 chars for identification
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user         User     @relation(fields: [userId], references: [id])
}
```

## Security

| Concern | Mitigation |
|---|---|
| Key at rest | AES-256-GCM encryption using `ENRICHMENT_KEY_SECRET` env var |
| Key in transit | HTTPS only; key POST body encrypted client-side in future |
| Key in logs | Regex scrubber strips `api_key`-like patterns from all log output |
| Frontend exposure | API returns `keyPrefix` + masked value (last 4 chars only) |
| Key rotation | DELETE `/api/settings/ai-key` + POST to replace |
| Runaway costs | Per-user Redis rate limiter (default: 30 enrichments/min, configurable via env) |

## Files to Create

| File | Purpose |
|---|---|
| `lib/enrichment/types.ts` | Shared types: `EnrichmentProvider`, `EnrichmentResult`, `EnrichmentContext` |
| `lib/enrichment/service.ts` | Provider-agnostic router — picks provider by name, calls `.enrich()` |
| `lib/enrichment/providers/gemini.ts` | `@google/generative-ai` client for Gemini 2.5 Flash |
| `lib/enrichment/providers/anthropic.ts` | Anthropic SDK client (Claude Haiku) — provider-agnostic |
| `lib/enrichment/providers/openai.ts` | OpenAI SDK client (GPT-4o-mini) — provider-agnostic |
| `lib/enrichment/strategies.ts` | Hybrid strategy: website scrape → LLM → fallback search |
| `lib/enrichment/rate-limiter.ts` | Redis-backed per-user token bucket |
| `lib/enrichment/encryption.ts` | AES-256-GCM encrypt/decrypt helpers |
| `lib/enrichment/log-sanitizer.ts` | Scrubs API keys from error/log messages |
| `app/api/enrich/[id]/route.ts` | **Replace stub** — single-lead on-demand enrichment |
| `app/api/settings/ai-key/route.ts` | CRUD for user's provider + encrypted API key |
| `app/(app)/settings/page.tsx` | AI Provider settings UI tab |

## Files to Modify

| File | Change |
|---|---|
| `server/index.ts` | Insert real enrichment loop between "enriching" broadcast and "formatting" |
| `prisma/schema.prisma` | Add `UserApiKey` model |
| `package.json` | Add `@google/generative-ai`, `@anthropic`, `openai` SDKs |
| `.env.example` | Add `ENRICHMENT_KEY_SECRET` |
| `stores/extraction-store.ts` | Handle WebSocket enrichment per-lead progress events |

## Enrichment Flow (Hybrid Strategy)

```
For each lead:
  1. Has website? → fetch HTML
     → strip noise (nav, ads, footers)
     → LLM prompt: "Extract email/phone from this business page"
     → email found? → write EnrichmentLog { source: "website_crawl" }
     → continue
  2. No email from website?
     → search query: "BUSINESS_NAME location email contact"
     → LLM prompt: "Extract email from these search snippets"
     → email found? → write EnrichmentLog { source: "search_fallback" }
  3. Still nothing?
     → write EnrichmentLog { source: "none", resultStatus: "not_found" }
     → mark lead status as "needs_enrich" for manual retry
```

## Rate Limiting

- Redis token bucket: `enrichment:{userId}:bucket`
- Default: 30 tokens, refill 10/min
- Configured via `ENRICHMENT_RATE_LIMIT` and `ENRICHMENT_RATE_WINDOW` env vars
- Applied in the enrichment service before each LLM call
- Returns 429 if exceeded (retry via BullMQ job retry mechanism)

## Dependencies to Add

```
@google/generative-ai   — Gemini SDK
openai                  — OpenAI SDK (also serves as Anthropic's SDK is optional)
```

Gemini 2.5 Flash is the default. Users switch via `settings.aiProvider` in the `UserApiKey` table.

## Future: Settings UI Page

Not implementing yet, but the architecture supports it:
- `GET /api/settings/ai-key` — returns provider + masked key (never full key)
- `POST /api/settings/ai-key` — accepts `{ provider, apiKey }`, encrypts, stores
- `DELETE /api/settings/ai-key` — removes key
- Frontend: tab in Settings → provider dropdown + masked key display + replace/remove buttons
