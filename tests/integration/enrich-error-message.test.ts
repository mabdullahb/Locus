import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Regression: on-demand enrichment failures always returned the generic
// "Enrichment failed" string to the client, discarding the real, specific,
// already-sanitized error message (e.g. an upstream provider's own rate
// limit message) that was being logged server-side and stored in
// enrichmentLog.errorMessage the whole time. The frontend (leads-store.ts's
// triggerEnrich) already reads `data.error` and shows it verbatim — the bug
// was entirely the route discarding a message it already had in hand.
vi.mock("@/lib/auth-helpers", () => ({
  requireUserId: vi.fn().mockResolvedValue("user-1"),
  unauthorized: () =>
    new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    businessLead: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    scrapeSession: { findUnique: vi.fn() },
    userApiKey: { findFirst: vi.fn() },
    enrichmentLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/enrichment", () => ({
  hybridEnrichLead: vi.fn(),
  decryptApiKey: vi.fn().mockReturnValue("decrypted-key"),
  getBusinessSearchValues: vi.fn().mockReturnValue(["serper"]),
  getAIProviderValues: vi.fn().mockReturnValue(["openrouter"]),
  sanitizeLog: (msg: string) => msg,
  canDowngradeEnrichmentStatus: () => true,
  // Real implementation, not a stub: this test's whole point is checking
  // the real error message reaches the client, so it needs the real
  // cause-appending behavior, not a mock that hides what it actually does.
  describeEnrichmentError: (err: unknown) => {
    const e = err as (Error & { cause?: unknown }) | undefined;
    const base = e?.message || String(err);
    if (!e?.cause) return base;
    return `${base} (cause: ${e.cause instanceof Error ? e.cause.message : String(e.cause)})`;
  },
}));

import { prisma } from "@/lib/db";
import { hybridEnrichLead } from "@/lib/enrichment";
import { POST } from "@/app/api/enrich/[id]/route";

describe("POST /api/enrich/[id] error surfacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.businessLead.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "lead-1",
      sessionId: "session-1",
      businessName: "Test Business",
      website: null,
      location: "Hyderabad",
      emailVerified: false,
    });
    (prisma.scrapeSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "session-1",
      userId: "user-1",
    });
    (prisma.userApiKey.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      provider: "openrouter",
      encryptedKey: "enc",
      model: null,
    });
    (prisma.enrichmentLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.businessLead.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it("returns the real provider error instead of a generic message", async () => {
    (hybridEnrichLead as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Rate limit exceeded: free-models-per-day. Add 5 credits to unlock 1000 free model requests per day"),
    );

    const req = new NextRequest("http://localhost/api/enrich/lead-1", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "lead-1" }) });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe(
      "Rate limit exceeded: free-models-per-day. Add 5 credits to unlock 1000 free model requests per day",
    );
    expect(body.error).not.toBe("Enrichment failed");
  });
});
