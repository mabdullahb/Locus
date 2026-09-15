import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/enrichment/rate-limiter", () => ({
  checkEnrichmentRateLimit: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/enrichment/service", () => ({
  enrichLead: vi.fn().mockResolvedValue({ email: null, phone: null, confidence: null, source: "none" }),
}));

import { hybridEnrichLead } from "@/lib/enrichment/strategies";
import { enrichLead } from "@/lib/enrichment/service";

describe("hybridEnrichLead SSRF protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(global, "fetch").mockImplementation(() => {
      throw new Error("fetch should not have been called for a disallowed website URL");
    });
  });

  it("never fetches a website pointed at cloud metadata", async () => {
    await hybridEnrichLead(
      "user-1",
      "gemini",
      "api-key",
      "Acme Corp",
      "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
      "New York",
    );
    expect(global.fetch).not.toHaveBeenCalled();
    expect(enrichLead).not.toHaveBeenCalled();
  });

  it("never fetches a website pointed at a private/internal address", async () => {
    for (const url of ["http://127.0.0.1:6379", "http://10.0.0.5/admin", "http://localhost:8080"]) {
      await hybridEnrichLead("user-1", "gemini", "api-key", "Acme Corp", url, "New York");
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
