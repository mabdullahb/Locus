import { describe, it, expect, vi } from "vitest";

// The fallback list is shown when OpenRouter's live catalog can't be
// reached. Checked against the live catalog on 2026-11-27: two of its free
// models had been removed from OpenRouter, and it offered GPT-4o / GPT-4o
// mini, which shut down on 2027-01-14. Picking any of those failed every
// enrichment.
// Found by /qa on 2026-11-27.
// Report: .gstack/qa-reports/qa-report-localhost-2026-11-27.md
vi.mock("@/lib/auth-helpers", () => ({
  requireUserId: vi.fn().mockResolvedValue("user-1"),
  unauthorized: () => new Response(null, { status: 401 }),
}));

import { GET } from "@/app/api/settings/openrouter-models/route";

describe("GET /api/settings/openrouter-models fallback", () => {
  it("serves only current models when OpenRouter is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const body = await (await GET()).json();
    const ids: string[] = body.models.map((m: { id: string }) => m.id);

    expect(body.source).toBe("fallback");
    for (const retired of ["openai/gpt-4o-mini", "openai/gpt-4o", "openai/gpt-oss-20b:free", "nvidia/nemotron-nano-9b-v2:free"]) {
      expect(ids).not.toContain(retired);
    }
    expect(ids).toContain("openai/gpt-6-luna");
    expect(body.models.some((m: { isFree: boolean }) => m.isFree)).toBe(true);
    vi.unstubAllGlobals();
  });
});
