import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  requireUserId: vi.fn().mockResolvedValue("user-1"),
  unauthorized: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    scrapeSession: { count: vi.fn(), findMany: vi.fn() },
    businessLead: { count: vi.fn() },
    enrichmentLog: { count: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { GET } from "@/app/api/analytics/trends/route";

const sessionCount = prisma.scrapeSession.count as ReturnType<typeof vi.fn>;
const leadCount = prisma.businessLead.count as ReturnType<typeof vi.fn>;
const logCount = prisma.enrichmentLog.count as ReturnType<typeof vi.fn>;

describe("GET /api/analytics/trends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.scrapeSession.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("reports the real lead-row count, verified count, and enrichment-run count separately", async () => {
    // Call order: totalExtractions, totalLeadsFound, totalEmailsVerified,
    // phoneCount, totalEnrichmentRuns, monthlyExtractions,
    // monthlyLeadsFound, monthlyEmailsVerified, monthlyPhoneCount,
    // monthlyEnrichmentRuns (see the route's own Promise.all order).
    sessionCount.mockResolvedValueOnce(28).mockResolvedValueOnce(6);
    leadCount
      .mockResolvedValueOnce(903)
      .mockResolvedValueOnce(377)
      .mockResolvedValueOnce(759)
      .mockResolvedValueOnce(41)
      .mockResolvedValueOnce(19)
      .mockResolvedValueOnce(33);
    logCount.mockResolvedValueOnce(1045).mockResolvedValueOnce(52);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totalExtractions).toBe(28);
    expect(body.totalLeadsFound).toBe(903);
    expect(body.totalEmailsVerified).toBe(377);
    expect(body.phoneCount).toBe(759);
    expect(body.totalEnrichmentRuns).toBe(1045);
    // verified count can never exceed the lead count
    expect(body.totalEmailsVerified).toBeLessThanOrEqual(body.totalLeadsFound);
  });

  // Regression: the Dashboard's "This Month" stat row used to read these
  // same totalX fields directly, which had no date filter at all, so it
  // silently showed all-time totals under a "This Month" label. The route
  // now returns a separate monthlyX set actually scoped to the current
  // calendar month, while totalX stays genuinely all-time for the
  // Analytics page's own "Extractions Run" / "Leads Found" cards, which
  // are not month-scoped.
  it("scopes the monthly fields to the current calendar month, separately from the all-time totals", async () => {
    sessionCount.mockResolvedValueOnce(28).mockResolvedValueOnce(6);
    leadCount
      .mockResolvedValueOnce(903)
      .mockResolvedValueOnce(377)
      .mockResolvedValueOnce(759)
      .mockResolvedValueOnce(41)
      .mockResolvedValueOnce(19)
      .mockResolvedValueOnce(33);
    logCount.mockResolvedValueOnce(1045).mockResolvedValueOnce(52);

    const res = await GET();
    const body = await res.json();

    expect(body.monthlyExtractions).toBe(6);
    expect(body.monthlyLeadsFound).toBe(41);
    expect(body.monthlyEmailsVerified).toBe(19);
    expect(body.monthlyPhoneCount).toBe(33);
    expect(body.monthlyEnrichmentRuns).toBe(52);
    // The monthly numbers must genuinely differ from (here: be smaller
    // than) the all-time ones in this fixture, so this test would fail if
    // the route accidentally reused the same unfiltered query for both.
    expect(body.monthlyLeadsFound).toBeLessThan(body.totalLeadsFound);

    // The actual bug: verify the monthly-scoped calls really do carry a
    // startedAt/createdAt/enrichedAt >= start-of-month filter, not just
    // that the mocked return value happens to differ.
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlySessionCall = sessionCount.mock.calls[1][0];
    expect(monthlySessionCall.where.startedAt.gte.getTime()).toBe(startOfMonth.getTime());

    const monthlyLeadCall = leadCount.mock.calls[3][0];
    expect(monthlyLeadCall.where.createdAt.gte.getTime()).toBe(startOfMonth.getTime());

    const monthlyLogCall = logCount.mock.calls[1][0];
    expect(monthlyLogCall.where.enrichedAt.gte.getTime()).toBe(startOfMonth.getTime());

    // And the all-time calls must NOT carry that filter, confirming the two
    // sets of numbers are actually independent, not both accidentally
    // scoped (or both accidentally unscoped).
    const allTimeSessionCall = sessionCount.mock.calls[0][0];
    expect(allTimeSessionCall.where.startedAt).toBeUndefined();
  });
});
