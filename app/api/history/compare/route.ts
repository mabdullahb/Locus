import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";

// Compares exactly two of the requesting user's own past sessions, side by
// side, so a repeat user can see whether a re-run or a different radius
// actually yielded more (or better-quality) leads. Read-only, no state
// change, so no upper bound beyond "exactly 2" is needed.
export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const idsParam = req.nextUrl.searchParams.get("ids") || "";
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);

  if (ids.length !== 2) {
    return NextResponse.json({ error: "Provide exactly two session ids via ?ids=a,b" }, { status: 400 });
  }

  const sessions = await prisma.scrapeSession.findMany({
    where: { id: { in: ids }, userId },
  });

  // Ownership check is implicit in the userId filter above. A session that
  // exists but belongs to someone else simply doesn't come back, same as a
  // session that doesn't exist at all. Both look identical to the caller,
  // which is the correct behavior for not leaking whether another
  // account's session id is valid.
  if (sessions.length !== 2) {
    return NextResponse.json({ error: "One or both sessions not found" }, { status: 404 });
  }

  const [leadGroups, statusGroups, enrichedCounts] = await Promise.all([
    prisma.businessLead.groupBy({
      by: ["sessionId"],
      where: { sessionId: { in: ids } },
      _count: { email: true, phone: true },
    }),
    prisma.businessLead.groupBy({
      by: ["sessionId", "status"],
      where: { sessionId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.enrichmentLog.groupBy({
      by: ["leadId"],
      where: { emailFound: true, lead: { sessionId: { in: ids } } },
    }),
  ]);

  // enrichmentLog only carries leadId, not sessionId directly, so mapping
  // enriched leadIds back to their session takes one more query, on just
  // the enriched leadIds rather than every lead in both sessions.
  const enrichedLeadIds = enrichedCounts.map((e) => e.leadId);
  const enrichedLeads = enrichedLeadIds.length
    ? await prisma.businessLead.findMany({
        where: { id: { in: enrichedLeadIds } },
        select: { id: true, sessionId: true },
      })
    : [];
  const enrichedBySessionId = new Map<string, number>();
  for (const lead of enrichedLeads) {
    enrichedBySessionId.set(lead.sessionId, (enrichedBySessionId.get(lead.sessionId) ?? 0) + 1);
  }

  const result = ids.map((id) => {
    const session = sessions.find((s) => s.id === id)!;
    const leadGroup = leadGroups.find((g) => g.sessionId === id);
    const breakdown = { verified: 0, needs_enrich: 0, pending: 0, failed: 0 };
    for (const g of statusGroups) {
      if (g.sessionId === id) {
        breakdown[g.status as keyof typeof breakdown] = g._count._all;
      }
    }
    return {
      id: session.id,
      query: session.query,
      location: session.location,
      status: session.status,
      startedAt: session.startedAt.getTime(),
      completedAt: session.completedAt?.getTime() ?? null,
      duration: session.duration,
      yield: {
        leads: session.totalYield ?? 0,
        emails: leadGroup?._count?.email ?? 0,
        phones: leadGroup?._count?.phone ?? 0,
        enriched: enrichedBySessionId.get(id) ?? 0,
      },
      statusBreakdown: breakdown,
    };
  });

  return NextResponse.json({ sessions: result });
}
