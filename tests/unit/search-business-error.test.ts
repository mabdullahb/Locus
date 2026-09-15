import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { hybridEnrichLead } from "@/lib/enrichment/strategies";

// Regression: a non-ok response from the search-snippet provider (expired
// key, out of credits, rate limited) used to be swallowed into an empty
// string, which hybridEnrichLead treats identically to genuinely finding no
// snippets. Every lead in the batch silently resolved to "not found" with no
// error surfaced anywhere, even though the real cause (the search provider
// account being out of credits) was fully knowable and actionable.
// hybridEnrichLead must now reject so the caller's real error handling
// (enrichmentLog.errorMessage, status "failed") sees it.
describe("hybridEnrichLead search-provider error surfacing", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("rejects when the Serper search call returns a non-ok response", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ message: "Not enough credits", statusCode: 400 }),
    });

    await expect(
      hybridEnrichLead(
        "user-1",
        "openrouter",
        "ai-key",
        "Mamta Pharmacy",
        null,
        "Hyderabad",
        "serper-key",
        undefined,
        "serper",
      ),
    ).rejects.toThrow(/Serper search failed \(400\).*Not enough credits/);
  });

  it("still resolves cleanly when Serper genuinely has no results", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ organic: [] }),
    });

    await expect(
      hybridEnrichLead(
        "user-1",
        "openrouter",
        "ai-key",
        "Mamta Pharmacy",
        null,
        "Hyderabad",
        "serper-key",
        undefined,
        "serper",
      ),
    ).resolves.toEqual({ email: null, phone: null, confidence: null, source: "none" });
  });
});
