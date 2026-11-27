import { describe, it, expect, vi, afterEach } from "vitest";
import { enrichLead } from "@/lib/enrichment/service";
import { describeEnrichmentError } from "@/lib/enrichment/errors";

// Regression: ISSUE-005. With an expired OpenRouter key the dashboard banner
// said only "API key expired." while the user had keys for seven providers
// saved, so nothing said which one to replace. Provider errors now carry the
// provider's name.
// Found by /qa on 2026-11-27.
// Report: .gstack/qa-reports/qa-report-localhost-2026-11-27.md
describe("enrichLead error messages", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("names OpenRouter when its key has expired", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "API key expired." } }),
      text: async () => JSON.stringify({ error: { message: "API key expired." } }),
    }));
    await expect(enrichLead("openrouter", "k", "Acme", "text", "deepseek/deepseek-v4-flash-0731")).rejects.toThrow(/^OpenRouter: .*API key expired/);
  });

  it("names Claude when Anthropic rejects the key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }),
    }));
    await expect(enrichLead("anthropic", "k", "Acme", "text")).rejects.toThrow("Claude (Anthropic): invalid x-api-key");
  });

  it("keeps the underlying cause for network failures", async () => {
    const netErr = Object.assign(new TypeError("fetch failed"), { cause: new Error("getaddrinfo ENOTFOUND api.anthropic.com") });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(netErr));
    const err = await enrichLead("anthropic", "k", "Acme", "text").catch((e) => e);
    expect(describeEnrichmentError(err)).toBe("Claude (Anthropic): fetch failed (cause: getaddrinfo ENOTFOUND api.anthropic.com)");
  });

  it("passes a successful result through unchanged", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: '{"email":"hi@acme.example","phone":null,"confidence":0.9}' }] }),
    }));
    await expect(enrichLead("anthropic", "k", "Acme", "text")).resolves.toMatchObject({ email: "hi@acme.example" });
  });
});
