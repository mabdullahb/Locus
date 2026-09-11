import { describe, it, expect } from "vitest";
import { getProviderInfo, getAIProviderValues, ALL_PROVIDERS } from "@/lib/enrichment/provider-registry";

describe("getProviderInfo", () => {
  it("finds a known provider by value", () => {
    expect(getProviderInfo("openrouter")?.label).toBe("OpenRouter");
  });

  it("returns undefined for an unknown provider", () => {
    expect(getProviderInfo("does-not-exist")).toBeUndefined();
  });

  it("marks 9router as adminOnly", () => {
    expect(getProviderInfo("9router")?.adminOnly).toBe(true);
  });

  it("does not mark regular providers as adminOnly", () => {
    expect(getProviderInfo("openrouter")?.adminOnly).toBeFalsy();
    expect(getProviderInfo("gemini")?.adminOnly).toBeFalsy();
  });
});

describe("getAIProviderValues", () => {
  // enrich/[id]/route.ts and retry-failed/route.ts look up a user's saved
  // key with `provider: { in: getAIProviderValues() } }` — this must stay
  // unfiltered by adminOnly, or an admin's already-saved 9router key would
  // stop being found during actual enrichment.
  it("still includes adminOnly providers, since key lookup must find them for users who have one saved", () => {
    expect(getAIProviderValues()).toContain("9router");
  });

  it("only returns ai-enrichment category providers, not business-search", () => {
    const values = getAIProviderValues();
    expect(values).not.toContain("serpapi");
    expect(values).not.toContain("serper");
  });
});

describe("ALL_PROVIDERS", () => {
  it("has a unique value for every provider", () => {
    const values = ALL_PROVIDERS.map((p) => p.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
