import { describe, it, expect, vi, beforeEach } from "vitest";

// Sentry v11 collects cookies, request/response bodies and database query
// data unless dataCollection says otherwise. For Locus those carry session
// cookies, passwords and provider API keys. Every runtime's Sentry.init must
// use the shared restrictive policy.
const init = vi.fn();
vi.mock("@sentry/nextjs", () => ({ init, captureRouterTransitionStart: vi.fn(), captureRequestError: vi.fn() }));

import { sentryDataCollection } from "@/lib/sentry/data-collection";

describe("Sentry data collection", () => {
  beforeEach(() => {
    init.mockClear();
    vi.resetModules();
  });

  it.each([
    ["browser", "@/instrumentation-client"],
    ["server", "@/sentry.server.config"],
    ["edge", "@/sentry.edge.config"],
  ])("the %s config passes the shared policy to Sentry.init", async (_runtime, path) => {
    await import(path);
    expect(init).toHaveBeenCalledTimes(1);
    expect(init.mock.calls[0][0].dataCollection).toEqual(sentryDataCollection);
  });

  it("never collects bodies, cookies, user info, database data, queue data or AI prompts", () => {
    expect(sentryDataCollection.httpBodies).toEqual([]);
    expect(sentryDataCollection.cookies).toBe(false);
    expect(sentryDataCollection.userInfo).toBe(false);
    expect(sentryDataCollection.databaseQueryData).toBe(false);
    expect(sentryDataCollection.queues).toBe(false);
    expect(sentryDataCollection.genAI).toEqual({ inputs: false, outputs: false });
  });

  it("denies every header Locus uses to carry a secret", () => {
    for (const dir of ["request", "response"] as const) {
      const deny = sentryDataCollection.httpHeaders[dir].deny;
      for (const h of ["authorization", "cookie", "set-cookie", "x-api-key", "x-internal-secret", "x-webhook-secret"]) {
        expect(deny).toContain(h);
      }
    }
  });

  it("the browser config also exports the router transition hook", async () => {
    const mod = await import("@/instrumentation-client");
    expect(mod.onRouterTransitionStart).toBeDefined();
  });
});
