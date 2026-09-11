import { describe, it, expect, vi, afterEach } from "vitest";
import { anthropicProvider } from "@/lib/enrichment/providers/anthropic";
import { openaiProvider } from "@/lib/enrichment/providers/openai";

// Regression: both providers used to read response.json() unconditionally,
// with no check on response.ok. An error body doesn't have the shape the
// success path expects (no .content for Anthropic, no .choices for OpenAI),
// so the field access silently fell through to an empty string, which then
// parsed as a clean "no email found" instead of a real failure. A real
// invalid key, rate limit, or bad model name was completely invisible: no
// error anywhere, just a lead marked needs_enrich forever.
describe("enrichment provider error handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("anthropic throws the real error message on a non-ok response instead of returning a clean empty result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }),
      }),
    );

    await expect(
      anthropicProvider.enrich({ apiKey: "bad-key", provider: "anthropic" }, "Acme Pharmacy", "some website text"),
    ).rejects.toThrow("invalid x-api-key");
  });

  it("openai throws the real error message on a non-ok response instead of returning a clean empty result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "Rate limit reached for requests" } }),
      }),
    );

    await expect(
      openaiProvider.enrich({ apiKey: "bad-key", provider: "openai" }, "Acme Pharmacy", "some website text"),
    ).rejects.toThrow("Rate limit reached for requests");
  });

  it("anthropic falls back to a status-based message when the error body has none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    await expect(
      anthropicProvider.enrich({ apiKey: "k", provider: "anthropic" }, "Acme Pharmacy", "text"),
    ).rejects.toThrow("Anthropic request failed with status 500");
  });

  it("openai falls back to a status-based message when the error body has none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    await expect(
      openaiProvider.enrich({ apiKey: "k", provider: "openai" }, "Acme Pharmacy", "text"),
    ).rejects.toThrow("OpenAI request failed with status 500");
  });
});
