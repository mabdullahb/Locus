import { describe, it, expect, vi, afterEach } from "vitest";
import { findEmailViaHunter, extractDomain } from "@/lib/enrichment/hunter";

describe("extractDomain", () => {
  it("strips a scheme and path from a full URL", () => {
    expect(extractDomain("https://acme.com/about/contact")).toBe("acme.com");
  });

  it("adds a scheme when the input is a bare hostname", () => {
    expect(extractDomain("acme.com")).toBe("acme.com");
  });

  it("strips a www prefix", () => {
    expect(extractDomain("https://www.acme.com")).toBe("acme.com");
  });

  it("returns null for something that isn't a usable URL at all", () => {
    expect(extractDomain("not a url, just text")).toBe(null);
  });
});

describe("findEmailViaHunter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("picks the highest-confidence email when Hunter returns several, regardless of response order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            emails: [
              { value: "low@acme.com", confidence: 40 },
              { value: "high@acme.com", confidence: 92 },
              { value: "mid@acme.com", confidence: 70 },
            ],
          },
        }),
      }),
    );

    const result = await findEmailViaHunter("acme.com", "test-key");
    expect(result.email).toBe("high@acme.com");
    expect(result.confidence).toBeCloseTo(0.92);
  });

  it("returns a null email, not an error, when Hunter has nothing on file for the domain", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { emails: [] } }) }),
    );
    const result = await findEmailViaHunter("unknown-domain.com", "test-key");
    expect(result).toEqual({ email: null, confidence: null });
  });

  it("throws with the real error message on a non-ok response, same standard as the AI providers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ errors: [{ details: "Invalid API key" }] }),
      }),
    );
    await expect(findEmailViaHunter("acme.com", "bad-key")).rejects.toThrow(/401/);
  });
});
