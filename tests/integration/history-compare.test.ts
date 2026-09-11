import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth-helpers", () => ({
  requireUserId: vi.fn(),
  unauthorized: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    scrapeSession: { findMany: vi.fn() },
    businessLead: { groupBy: vi.fn(), findMany: vi.fn() },
    enrichmentLog: { groupBy: vi.fn() },
  },
}));

import { requireUserId } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { GET } from "@/app/api/history/compare/route";

const findMany = prisma.scrapeSession.findMany as ReturnType<typeof vi.fn>;
const leadGroupBy = prisma.businessLead.groupBy as ReturnType<typeof vi.fn>;
const leadFindMany = prisma.businessLead.findMany as ReturnType<typeof vi.fn>;
const logGroupBy = prisma.enrichmentLog.groupBy as ReturnType<typeof vi.fn>;

function compare(idsParam: string) {
  return GET(new NextRequest(`http://localhost/api/history/compare?ids=${idsParam}`));
}

const baseSession = (id: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  id,
  userId: "user-1",
  query: `query-${id}`,
  location: "Seattle, WA",
  status: "completed",
  totalYield: 10,
  startedAt: new Date("2026-01-01T00:00:00Z"),
  completedAt: new Date("2026-01-01T00:10:00Z"),
  duration: 600,
  ...overrides,
});

describe("GET /api/history/compare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-1");
    leadGroupBy.mockResolvedValue([]);
    leadFindMany.mockResolvedValue([]);
    logGroupBy.mockResolvedValue([]);
  });

  it("401s when not authenticated", async () => {
    (requireUserId as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Unauthorized"));
    expect((await compare("a,b")).status).toBe(401);
  });

  it("400s when not exactly two ids are given", async () => {
    expect((await compare("a")).status).toBe(400);
    expect((await compare("a,b,c")).status).toBe(400);
    expect((await compare("")).status).toBe(400);
  });

  it("404s when one of the two sessions doesn't belong to the requesting user", async () => {
    // Only one row comes back because the ownership filter (userId in the
    // findMany where clause) silently excludes the other account's session.
    // That looks identical to a nonexistent id, which is the correct
    // behavior for not leaking whether another account's session id exists.
    findMany.mockResolvedValue([baseSession("a")]);
    const res = await compare("a,b");
    expect(res.status).toBe(404);
  });

  it("404s when both ids are missing entirely", async () => {
    findMany.mockResolvedValue([]);
    expect((await compare("a,b")).status).toBe(404);
  });

  it("returns both sessions with yield and status-breakdown fields, in requested order", async () => {
    findMany.mockResolvedValue([
      baseSession("b", { totalYield: 5 }),
      baseSession("a", { totalYield: 20 }),
    ]);
    const statusRows = [
      { sessionId: "a", status: "verified", _count: { _all: 8 } },
      { sessionId: "a", status: "failed", _count: { _all: 2 } },
      { sessionId: "b", status: "needs_enrich", _count: { _all: 3 } },
    ];
    logGroupBy.mockResolvedValue([
      { leadId: "lead-a1" },
      { leadId: "lead-b1" },
    ]);
    leadFindMany.mockResolvedValue([
      { id: "lead-a1", sessionId: "a" },
      { id: "lead-b1", sessionId: "b" },
    ]);
    // The route issues two businessLead.groupBy calls, in this order (yield
    // counts first, status breakdown second), so mockResolvedValueOnce
    // chaining matches that call order, not resolution order.
    leadGroupBy
      .mockResolvedValueOnce([
        { sessionId: "a", _count: { email: 8, phone: 15 } },
        { sessionId: "b", _count: { email: 2, phone: 4 } },
      ])
      .mockResolvedValueOnce(statusRows);

    const res = await compare("a,b");
    const body = await res.json();

    expect(res.status).toBe(200);
    // Response order follows the requested ids param (a,b), not whatever
    // order the database happened to return the rows in.
    expect(body.sessions.map((s: { id: string }) => s.id)).toEqual(["a", "b"]);

    const sessionA = body.sessions[0];
    expect(sessionA.yield).toEqual({ leads: 20, emails: 8, phones: 15, enriched: 1 });
    expect(sessionA.statusBreakdown).toEqual({ verified: 8, needs_enrich: 0, pending: 0, failed: 2 });

    const sessionB = body.sessions[1];
    expect(sessionB.yield).toEqual({ leads: 5, emails: 2, phones: 4, enriched: 1 });
    expect(sessionB.statusBreakdown).toEqual({ verified: 0, needs_enrich: 3, pending: 0, failed: 0 });
  });

  it("does not query for enriched leads when nothing was enriched in either session", async () => {
    findMany.mockResolvedValue([baseSession("a"), baseSession("b")]);
    logGroupBy.mockResolvedValue([]);
    await compare("a,b");
    expect(leadFindMany).not.toHaveBeenCalled();
  });
});
