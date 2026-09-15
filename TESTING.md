# Testing

100% test coverage is the key to great vibe coding. Tests let you move fast,
trust your instincts, and ship with confidence — without them, vibe coding is
just yolo coding. With tests, it's a superpower.

## Framework

- **Unit / integration:** [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com/react)
- **E2E:** [Playwright](https://playwright.dev)

## Running tests

```bash
npm test          # run all unit/integration tests once
npm run test:watch # watch mode
npm run test:e2e   # run Playwright e2e tests (requires the dev server running)
```

## Test layers

- **Unit tests** (`tests/unit/`) — pure functions and isolated logic (rate
  limiters, log sanitization, plan/provider lookups). No DB, no network, no
  React rendering.
- **Integration tests** (`tests/integration/`) — component behavior with
  Testing Library, or logic that touches multiple modules together. Mock
  external dependencies (Prisma, fetch, etc.).
- **E2E tests** (`tests/e2e/`) — Playwright, full browser, real (or seeded)
  dev server. Reserved for critical user flows.

## Conventions

- File naming: `<subject>.test.ts` (unit/integration) under `tests/unit/` or
  `tests/integration/`; Playwright specs under `tests/e2e/`.
- Use `describe`/`it`, not `test`.
- Assert real behavior, not "it doesn't throw" or "it's defined." A test
  should fail if the underlying bug it guards against comes back.
- Regression tests carry a comment linking the bug: what broke, when it was
  found, and (for `/qa`-generated tests) the report file.
- Mock all external dependencies (Prisma, fetch, Redis) in unit/integration
  tests. No real DB or network calls outside `tests/e2e/`.

## QA scope: state, not just happy path

A `/qa` pass against a fresh account on default settings will pass even when
real bugs exist, because a clean run never produces the state those bugs
need. Confirmed on this project: a wrong-radius re-run bug, a button that
silently discarded typed input, an extraction stuck forever with no error,
and an unnoticed dual-active-provider conflict all passed repeated `/qa` runs
because none of them were reachable from a blank-slate happy path. All of
those happened to surface on the Dashboard/History/enrichment flow, but the
same four dimensions apply to every page and feature in this app, not just
the one where they were first found:

- Dashboard (survey form, live progress, leads table)
- History (list, filters, Re-run, bulk delete, per-session detail)
- AI Enrichment (`/enrichment`) and per-lead retry/enrich
- Integrations (`/integrations`), including webhook delivery
- Analytics (`/analytics`)
- API Keys / Settings (`/api-keys`, `/settings`), all provider tabs
- Proxy Management (`/proxy`)
- Admin (`/admin`)
- Export (any `/api/export/*` path)

For each of the above, every QA pass must deliberately construct all four of
these, not just exercise the primary flow once:

- **Non-default inputs carried through a resume/re-run/retry flow.** Run with
  a changed parameter (radius, depth, locale, filters, page size, whatever
  that feature exposes), then use whatever "do this again" action exists for
  it (Re-run, "Load more," retry, re-save), and diff the parameters actually
  used against the original, not just against whatever the UI displays.
- **Pre-existing state before the action under test**, not a clean account.
  A leftover completed-but-resumable session, an already-partially-filled
  form, more than one saved credential in a category meant to have only one
  active, existing rows from a prior run sitting in a list. Real accounts
  accumulate state across every feature, day-one accounts don't.
- **A restart or crash mid-operation**, not just success and clean failure.
  If a background worker, job, or long request dies partway through
  anything (not only extraction), does the relevant UI recover and tell the
  user, or does it freeze silently forever?
- **A degraded external dependency**, not just the API being up. Simulate a
  rate limit, a slow response, or a malformed body from anything third-party
  this app talks to (search providers, LLM providers, webhooks, proxies,
  export destinations) and confirm the surfaced error is the real,
  actionable one, not a generic wrapper string.

Treat this section as a checklist run against the full feature list above,
not a one-time fix scoped to whichever bug prompted writing it down.

## Single source of truth for stored configuration

The wrong-radius re-run bug above had a specific, generalizable shape worth
naming on its own: `/api/history/route.ts` and `/api/history/[id]/route.ts`
returned a hardcoded fake `config` object (`radius: "25"`, `concurrency: 8`,
`enrichmentDepth: "standard"` as literal constants) instead of the session's
real stored `radius`/`concurrency`/`proxyType` columns and `config` JSON, and
`lib/rerun-params.ts` separately never carried `radius`/`locale` through the
rerun URL at all. Two independent places each reconstructed their own version
of a value that already had one real, authoritative source.

Any value that affects behavior (radius, locale, enrichment depth, provider,
model, concurrency) must be read from its one real stored location and
carried through the whole flow (save, list, detail, resume, re-run, retry),
never reconstructed, defaulted, or hardcoded a second time by a different
part of the codebase. When adding a new stored setting, grep for every place
that already returns or consumes that entity's shape before adding a new
one, and confirm none of them fake or default the new field.
