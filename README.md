<div align="center">

<img src="docs/brand/locus-wordmark.svg" width="280" alt="Locus">

### Self-hosted Google Maps lead extraction and AI enrichment

**Search a location and category, pull real business listings, enrich them
with AI-verified emails. Free, open-source, bring your own keys, no account
with us, no fees.**

[![Tests](https://github.com/mabdullahb/Locus/actions/workflows/test.yml/badge.svg)](https://github.com/mabdullahb/Locus/actions/workflows/test.yml) [![License: AGPL-3.0](https://img.shields.io/github/license/mabdullahb/Locus)](LICENSE) [![Docker ready](https://img.shields.io/badge/docker-ready-2496ED)](docker-compose.yml) [![Self-hosted](https://img.shields.io/badge/self--hosted-yes-blue)](#run-it-for-real-with-docker) [![GitHub stars](https://img.shields.io/github/stars/mabdullahb/Locus)](https://github.com/mabdullahb/Locus/stargazers)

[Quickstart](#setup) | [Self-Hosting](#run-it-for-real-with-docker) | [Development](#development) | [Contributing](#contributing)

</div>

---

Locus runs a pipeline: search a place and a category, pull the matching
businesses, then run each one through an AI enrichment step that tries to find a
verified email. Results land in a table you can filter, sort, export (CSV, Excel,
JSON), or push to a webhook.

![Locus demo: search, live results, and history](docs/screenshots/demo.gif)

Built with Next.js (App Router), Prisma and Postgres, NextAuth, BullMQ and Redis
for the background worker, and a bring-your-own-key model for the search and AI
providers.

## Features

- **Search and extraction**: a location, a category, and a radius pull real
  Google Maps business listings, with live progress over WebSocket.
- **Bulk search from a CSV**: upload a file of query/location pairs (an
  optional radius per row) and queue up to 50 searches at once instead of
  running them one at a time.
- **AI enrichment**: each business gets run through an LLM step that tries to
  find and verify a real contact email from its website, alongside phone
  numbers pulled from the listing itself. Choose from Gemini, OpenAI,
  Anthropic, or OpenRouter.
- **Real SMTP verification**: on top of the AI's answer, a genuine mailbox
  check (MX lookup, then an SMTP handshake, nothing ever gets sent) confirms
  an email before it's marked verified, not just an AI guess.
- **Optional Hunter.io lookup**: add a Hunter.io key and it's checked before
  the website-and-AI step runs, skipping straight to a known email when
  Hunter already has one on file for the domain.
- **Cross-session matching**: the same business found in two different
  searches gets recognized and merged, not duplicated, backfilling any
  missing phone or email instead of creating a second row.
- **History**: every past search is kept with its full config snapshot.
  Re-run one, open a past search's results straight from the list, or
  select two sessions to compare their yield side by side.
- **Export and integrations**: CSV, Excel, or JSON export, plus outbound
  webhooks and CRM connectors (HubSpot, Salesforce).
- **Bring your own key, for everything**: search provider, AI provider,
  database, Redis, the server itself. No hosted version, no vendor lock-in,
  nothing running that you don't control.
- **Built for self-hosting**: a real Docker Compose stack (app, worker,
  Postgres, Redis) that's actually been cold-started and verified end to
  end, not just written and assumed to work.

## Heads up on scraping

Locus pulls data from Google Maps and third-party search APIs. Automated
collection of Google Maps data is against Google's Terms of Service. You are
responsible for how you run this, which providers and proxies you use, and
whether that is allowed where you operate. This project is provided for research
and educational purposes with no warranty. See the licence.

## Requirements

- Node.js 20+
- Docker (for local Postgres and Redis) or your own instances
- A search provider key (SerpApi, Serper.dev, or Google Places)
- An AI provider key (Gemini, OpenAI, Anthropic, or OpenRouter) for enrichment

## Setup

There's no hosted version of Locus. Running it, for local development or for
real, is entirely up to you: your own Postgres, your own Redis, your own
server or machine. Two ways to do that:

### Run it for real, with Docker

This builds and runs everything, the app, the worker, Postgres, and Redis,
as one stack.

```bash
git clone https://github.com/<you>/locus.git
cd locus
cp .env.example .env
# Fill in NEXTAUTH_URL, NEXTAUTH_SECRET, ENRICHMENT_KEY_SECRET, and
# INTERNAL_API_SECRET in .env before continuing. Docker compose refuses to
# start without them, on purpose.
docker compose up --build -d
```

Open the app at the `NEXTAUTH_URL` you set (`http://localhost:3000` for a
same-machine test), create an account, and add your provider keys in
Settings. See the comments in `docker-compose.yml` and `.env.example` for
what `NEXT_PUBLIC_WS_URL` needs to be once this is reachable from outside
your own machine (it has to be a real address a browser can reach, not a
Docker-internal one), and put a reverse proxy (nginx, Caddy, Traefik) in
front for HTTPS rather than exposing the app's port directly.

### Run it for development, without Docker

```bash
git clone https://github.com/<you>/locus.git
cd locus
npm install
cp .env.example .env
docker compose up -d postgres redis
npx prisma migrate deploy
npm run dev:all
```

Postgres comes up on port 5433, Redis on 6379, the app on 3000, the worker on
4000, all with reload on file changes.

### Environment

`.env.example` documents every variable. The ones you must set for a working
install, Docker or not:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Postgres connection string. The compose file uses `postgresql://locus:locus_dev@localhost:5433/locus` by default |
| `REDIS_URL` | Redis connection string for the job queue |
| `NEXTAUTH_SECRET` | Session signing secret. `openssl rand -base64 32` |
| `NEXTAUTH_URL` | The app's real public URL, `http://localhost:3000` for local testing |
| `ENRICHMENT_KEY_SECRET` | Encrypts provider keys at rest. `openssl rand -hex 32` |
| `INTERNAL_API_SECRET` | Shared secret between the app and the worker. `openssl rand -hex 32` |
| `FRONTEND_ORIGIN` | Origin allowed to reach the worker, `http://localhost:3000` in dev |

Optional: `RESEND_API_KEY` (password-reset email, logs the link to the console
when unset), `SENTRY_*`, `NINE_ROUTER_BASE_URL` (self-hosted model router),
`TRUST_PROXY_HEADERS` (only if a reverse proxy sits in front of this app).

## How to use it

Once the app is running and you've created an account:

1. **Add provider keys.** Settings > API Keys needs one business-search key
   (SerpApi, Serper.dev, or Google Places) and one AI key (Gemini, OpenAI,
   Anthropic, or OpenRouter) before anything can run. SerpApi and Serper.dev
   both have a free way to get started, no card required. A Hunter.io key
   is optional, it has a free tier (50 lookups/month) and, when added, gets
   checked before the website-and-AI enrichment step runs.

   ![API Keys](docs/screenshots/api-keys.png)

2. **Run a search**, one at a time on the Dashboard, or **upload a CSV**
   for several at once (a `query` column and a `location` column, an
   optional `radius` column per row). Progress streams in live: businesses
   found, phone numbers extracted, emails verified, as they happen, not
   just at the end.

3. **Work the results.** The leads table supports filtering by status
   (verified, needs enrichment, pending, failed), search, sort, and bulk
   actions. A lead that failed enrichment can be retried individually or in
   bulk. The same business found again in a later search gets merged into
   its existing lead instead of duplicated. Export whenever you want a CSV,
   Excel file, or JSON, or push results to a webhook or CRM connector.

4. **Come back to it later.** Every search lands in History with its full
   config snapshot (radius, provider, enrichment depth). Click any past
   search to reopen its results, re-run it with the same settings, or select
   two searches to compare their yield side by side.

   ![History](docs/screenshots/history.png)

## Development

```bash
npm run dev:all        # app plus worker with reload
npm test               # Vitest unit and integration
npm run test:e2e       # Playwright, needs the app running
npx tsc --noEmit       # typecheck
```

See `TESTING.md` for the test layers and conventions.

## Architecture

- `app/`, Next.js App Router pages and API routes
- `server/index.ts`, the Express and BullMQ worker that runs searches and
  enrichment and pushes progress over WebSocket
- `lib/enrichment/`, provider adapters and the enrichment waterfall
- `lib/export/`, CSV/Excel/JSON export and the webhook/connector layer
- `prisma/schema.prisma`, the data model

## Contributing

See `CONTRIBUTING.md`. Security reports go through `SECURITY.md`, not public
issues.

## Licence

AGPL-3.0-or-later. If you run a modified version as a network service, you have
to make your changes available to its users. See `LICENSE`.

---

<div align="center">

Built by [Cloudz Computing](https://www.cloudzcomputing.com)

</div>
