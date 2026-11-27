import { describe, it, expect, vi, afterEach } from "vitest";
import { anthropicProvider } from "@/lib/enrichment/providers/anthropic";

// Regression: ISSUE-006. The Claude provider defaulted to
// claude-3-haiku-20240307, retired on 2026-04-20, so every request failed.
// Moving to a current model also needs the parser fixed: current models
// return thinking blocks before the answer, and the provider read
// content[0].text, which made every lead "no email found".
// Found by /qa on 2026-11-27.
// Report: .gstack/qa-reports/qa-report-localhost-2026-11-27.md
function mockClaude(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const ctx = { apiKey: "k", provider: "anthropic" as const };

describe("anthropicProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("defaults to a current model, not the retired Claude 3 Haiku", async () => {
    const fetchMock = mockClaude({ stop_reason: "end_turn", content: [{ type: "text", text: '{"email":null,"phone":null,"confidence":0}' }] });
    await anthropicProvider.enrich(ctx, "Acme Pharmacy", "text");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("claude-haiku-5-5");
    expect(body.model).not.toMatch(/claude-3/);
    expect(body.output_config).toEqual({ effort: "low" });
    expect(body.max_tokens).toBeGreaterThanOrEqual(4096);
  });

  it("still honours an explicitly configured model", async () => {
    const fetchMock = mockClaude({ stop_reason: "end_turn", content: [{ type: "text", text: "{}" }] });
    await anthropicProvider.enrich({ ...ctx, model: "claude-sonnet-5-5" }, "Acme Pharmacy", "text");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("claude-sonnet-5-5");
  });

  it("reads the answer from the text block that follows a thinking block", async () => {
    mockClaude({
      stop_reason: "end_turn",
      content: [
        { type: "thinking", thinking: "", signature: "sig" },
        { type: "text", text: '{"email":"hello@acme.example","phone":"(830) 555-0101","confidence":0.9}' },
      ],
    });
    const result = await anthropicProvider.enrich(ctx, "Acme Pharmacy", "text");
    expect(result).toMatchObject({ email: "hello@acme.example", phone: "(830) 555-0101", confidence: 0.9 });
  });

  it("throws on a refusal instead of reporting no email found", async () => {
    mockClaude({ stop_reason: "refusal", content: [] });
    await expect(anthropicProvider.enrich(ctx, "Acme Pharmacy", "text")).rejects.toThrow(/declined/);
  });

  it("returns an empty result when the answer genuinely has no contact info", async () => {
    mockClaude({ stop_reason: "end_turn", content: [{ type: "text", text: '{"email":null,"phone":null,"confidence":0}' }] });
    const result = await anthropicProvider.enrich(ctx, "Acme Pharmacy", "text");
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
  });
});
