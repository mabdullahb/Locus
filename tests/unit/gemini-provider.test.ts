import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression: ISSUE-007. The Gemini provider defaulted to gemini-2.0-flash,
// which Google shut down on 2026-06-01, so the Gemini option failed for
// every user. Google's listed replacement is gemini-3.6-flash.
// Found by /qa on 2026-11-27.
// Report: .gstack/qa-reports/qa-report-localhost-2026-11-27.md
const getGenerativeModel = vi.fn();
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = getGenerativeModel;
  },
}));

import { geminiProvider } from "@/lib/enrichment/providers/gemini";

describe("geminiProvider", () => {
  beforeEach(() => {
    getGenerativeModel.mockReset().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({ response: { text: () => '{"email":"hi@acme.example","phone":null,"confidence":0.8}' } }),
    });
  });

  it("defaults to a model Google still serves", async () => {
    await geminiProvider.enrich({ apiKey: "k", provider: "gemini" }, "Acme", "text");
    expect(getGenerativeModel).toHaveBeenCalledWith({ model: "gemini-3.6-flash" });
  });

  it("honours an explicitly configured model", async () => {
    await geminiProvider.enrich({ apiKey: "k", provider: "gemini", model: "gemini-3.8-flash" }, "Acme", "text");
    expect(getGenerativeModel).toHaveBeenCalledWith({ model: "gemini-3.8-flash" });
  });

  it("parses the email from the response", async () => {
    const r = await geminiProvider.enrich({ apiKey: "k", provider: "gemini" }, "Acme", "text");
    expect(r.email).toBe("hi@acme.example");
  });
});
