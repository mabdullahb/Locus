import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/enrichment/rate-limiter", () => ({
  checkEnrichmentRateLimit: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/enrichment/service", () => ({
  enrichLead: vi.fn().mockResolvedValue({ email: null, phone: null, confidence: null, source: "none" }),
}));

import { hybridEnrichLead } from "@/lib/enrichment/strategies";
import { enrichLead } from "@/lib/enrichment/service";

function mockFetchSequence(handlers: Array<(url: string) => unknown>) {
  let call = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const handler = handlers[Math.min(call, handlers.length - 1)];
    call++;
    return handler(url);
  }));
}

describe("hybridEnrichLead: Hunter.io as an optional pre-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never calls Hunter, and behaves exactly as before, when no Hunter key is configured", async () => {
    mockFetchSequence([
      () => ({ ok: true, text: async () => "<html>no email here</html>" }),
    ]);
    await hybridEnrichLead("user-1", "gemini", "api-key", "Acme Corp", "https://acme.com", "New York", undefined, undefined, undefined, undefined);
    const calledUrls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calledUrls.some((u) => String(u).includes("hunter.io"))).toBe(false);
    expect(calledUrls.some((u) => String(u).includes("acme.com"))).toBe(true);
  });

  it("returns Hunter's result immediately and skips fetching the website entirely when Hunter has an answer", async () => {
    mockFetchSequence([
      () => ({
        ok: true,
        json: async () => ({ data: { emails: [{ value: "found@acme.com", confidence: 85 }] } }),
      }),
    ]);
    const result = await hybridEnrichLead(
      "user-1", "gemini", "api-key", "Acme Corp", "https://acme.com", "New York",
      undefined, undefined, undefined, "hunter-key",
    );
    expect(result.email).toBe("found@acme.com");
    expect(result.source).toBe("website");
    expect(enrichLead).not.toHaveBeenCalled();
    const calledUrls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    // Exactly one fetch happened (Hunter's API), the actual acme.com site
    // was never fetched at all, since Hunter already answered.
    expect(calledUrls.filter((u) => String(u).includes("acme.com") && !String(u).includes("hunter.io")).length).toBe(0);
  });

  it("falls through to the normal website+AI cascade when Hunter has nothing on file", async () => {
    mockFetchSequence([
      () => ({ ok: true, json: async () => ({ data: { emails: [] } }) }), // Hunter: nothing found
      () => ({ ok: true, text: async () => "<html>Contact us at hello@acme.com</html>" }), // website fetch
    ]);
    await hybridEnrichLead(
      "user-1", "gemini", "api-key", "Acme Corp", "https://acme.com", "New York",
      undefined, undefined, undefined, "hunter-key",
    );
    expect(enrichLead).toHaveBeenCalled();
  });

  it("falls through gracefully, does not throw, when the Hunter API call itself fails", async () => {
    mockFetchSequence([
      () => { throw new Error("Hunter.io unreachable"); },
      () => ({ ok: true, text: async () => "<html>fallback content</html>" }),
    ]);
    await expect(
      hybridEnrichLead(
        "user-1", "gemini", "api-key", "Acme Corp", "https://acme.com", "New York",
        undefined, undefined, undefined, "hunter-key",
      ),
    ).resolves.toBeDefined();
    expect(enrichLead).toHaveBeenCalled();
  });

  it("never attempts Hunter when there's no website to derive a domain from", async () => {
    mockFetchSequence([() => ({ ok: true, json: async () => ({ organic: [] }) })]);
    await hybridEnrichLead(
      "user-1", "gemini", "api-key", "Acme Corp", null, "New York",
      undefined, undefined, undefined, "hunter-key",
    );
    const calledUrls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calledUrls.some((u) => String(u).includes("hunter.io"))).toBe(false);
  });
});
