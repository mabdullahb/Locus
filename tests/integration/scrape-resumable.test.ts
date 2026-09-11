import { describe, it, expect, vi, beforeEach } from "vitest";

// The Dashboard's "Load 100 more" button only existed in the extraction
// Zustand store — a page reload reset it to idle and silently lost the
// option even when the provider genuinely had more results for that search.
// This endpoint re-derives "is there a resumable search" from the DB so the
// Dashboard can restore it on a fresh mount (see app/(app)/dashboard/page.tsx).
vi.mock("@/lib/auth-helpers", () => ({
  requireUserId: vi.fn().mockResolvedValue("user-1"),
  unauthorized: () =>
    new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    scrapeSession: { findMany: vi.fn() },
    businessLead: { count: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { GET } from "@/app/api/scrape/resumable/route";

describe("GET /api/scrape/resumable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no completed session has more results", async () => {
    (prisma.scrapeSession.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "s1", query: "gym", location: "Hyderabad", totalYield: 14, config: { hasMore: false } },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.session).toBeNull();
    expect(prisma.businessLead.count).not.toHaveBeenCalled();
  });

  it("returns the most recent completed session that still has more results", async () => {
    (prisma.scrapeSession.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "s1", query: "restaurant", location: "Hyderabad", totalYield: 97, config: { hasMore: true } },
      { id: "s0", query: "gym", location: "Hyderabad", totalYield: 14, config: { hasMore: false } },
    ]);
    (prisma.businessLead.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(18) // phonesExtracted
      .mockResolvedValueOnce(20) // emailsVerified
      .mockResolvedValueOnce(20); // fullyEnriched

    const res = await GET();
    const body = await res.json();

    expect(body.session).toEqual({
      id: "s1",
      query: "restaurant",
      location: "Hyderabad",
      totalYield: 97,
      phonesExtracted: 18,
      emailsVerified: 20,
      fullyEnriched: 20,
    });
  });
});
