import { describe, it, expect, vi, afterEach } from "vitest";
import { openaiProvider } from "@/lib/enrichment/providers/openai";

// gpt-4o-mini shuts down on 2027-01-14 (OpenAI deprecations page), which
// would have broken the OpenAI option the same way the Claude and Gemini
// defaults broke (ISSUE-006, ISSUE-007). Newer OpenAI models also reject
// max_tokens in favour of max_completion_tokens.
// Found by /qa on 2026-11-27.
// Report: .gstack/qa-reports/qa-report-localhost-2026-11-27.md
function mockOpenAI(content: string) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("openaiProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("defaults to the model OpenAI lists as gpt-4o-mini's replacement", async () => {
    const fetchMock = mockOpenAI('{"email":null,"phone":null,"confidence":0}');
    await openaiProvider.enrich({ apiKey: "k", provider: "openai" }, "Acme", "text");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("gpt-6-luna");
  });

  it("uses max_completion_tokens, which newer models require", async () => {
    const fetchMock = mockOpenAI("{}");
    await openaiProvider.enrich({ apiKey: "k", provider: "openai" }, "Acme", "text");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.max_completion_tokens).toBeGreaterThanOrEqual(4096);
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("honours an explicitly configured model", async () => {
    const fetchMock = mockOpenAI("{}");
    await openaiProvider.enrich({ apiKey: "k", provider: "openai", model: "gpt-4.1-mini" }, "Acme", "text");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("gpt-4.1-mini");
  });

  it("parses the email from the reply", async () => {
    mockOpenAI('{"email":"hi@acme.example","phone":"(830) 555-0101","confidence":0.9}');
    const r = await openaiProvider.enrich({ apiKey: "k", provider: "openai" }, "Acme", "text");
    expect(r).toMatchObject({ email: "hi@acme.example", phone: "(830) 555-0101" });
  });
});
