import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/enrichment/rate-limiter", () => ({
  checkEnrichmentRateLimit: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/enrichment/service", () => ({
  enrichLead: vi.fn().mockResolvedValue({ email: null, phone: null, confidence: null, source: "none" }),
}));

import { hybridEnrichLead } from "@/lib/enrichment/strategies";

// Regression: an aborted search-provider fetch (the 10s SEARCH_TIMEOUT
// firing) threw the generic "This operation was aborted" with no
// indication of which provider or what happened, unlike the equivalent
// search calls in server/index.ts, which already translate an AbortError
// into a clear "<Provider> request timed out" message. That generic
// message was what actually surfaced as a lead's failure reason in
// production (confirmed live: enrichmentLog.errorMessage on two leads read
// exactly "This operation was aborted").
function abortError(): Error {
  const err = new Error("This operation was aborted");
  err.name = "AbortError";
  return err;
}

describe("hybridEnrichLead search-fallback timeout messaging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("translates an aborted SerpApi search into a clear timeout message", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(abortError());

    await expect(
      hybridEnrichLead(
        "user-1",
        "gemini",
        "api-key",
        "Acme Corp",
        null,
        "New York",
        "extraction-key",
        undefined,
        "serpapi",
      ),
    ).rejects.toThrow("SerpApi search timed out");
  });

  it("translates an aborted Serper.dev search into a clear timeout message", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(abortError());

    await expect(
      hybridEnrichLead(
        "user-1",
        "gemini",
        "api-key",
        "Acme Corp",
        null,
        "New York",
        "extraction-key",
        undefined,
        "serper",
      ),
    ).rejects.toThrow("Serper.dev search timed out");
  });

  it("still propagates a genuine provider error (not an abort) unchanged", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 402,
      text: () => Promise.resolve('{"message":"Not enough credits"}'),
    } as Response);

    await expect(
      hybridEnrichLead(
        "user-1",
        "gemini",
        "api-key",
        "Acme Corp",
        null,
        "New York",
        "extraction-key",
        undefined,
        "serper",
      ),
    ).rejects.toThrow(/Serper search failed \(402\)/);
  });
});
