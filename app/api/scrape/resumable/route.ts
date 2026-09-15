import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";

// The Dashboard's "Load 100 more" button only exists as long as the
// extraction Zustand store still has the session in memory — a fresh page
// load (or coming back to the tab tomorrow) resets that store to idle, and
// with it any way to tell the user their last search hit the provider's
// per-batch cap and could yield more. This re-derives that from the DB (the
// scrapeSession this batch's continuation/hasMore was written to on
// completion — see server/index.ts) so the option survives a reload.
export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const candidates = await prisma.scrapeSession.findMany({
    where: { userId, status: "completed" },
    orderBy: { completedAt: "desc" },
    take: 10,
    select: { id: true, query: true, location: true, totalYield: true, config: true },
  });

  const session = candidates.find((s) => (s.config as Record<string, unknown> | null)?.hasMore === true);
  if (!session) {
    return NextResponse.json({ session: null });
  }

  const [phonesExtracted, emailsVerified, fullyEnriched] = await Promise.all([
    prisma.businessLead.count({ where: { sessionId: session.id, phone: { not: null } } }),
    prisma.businessLead.count({ where: { sessionId: session.id, email: { not: null } } }),
    prisma.businessLead.count({ where: { sessionId: session.id, status: "verified" } }),
  ]);

  return NextResponse.json({
    session: {
      id: session.id,
      query: session.query,
      location: session.location,
      totalYield: session.totalYield,
      phonesExtracted,
      emailsVerified,
      fullyEnriched,
    },
  });
}
