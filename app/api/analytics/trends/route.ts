import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  try {
    // Two different callers read this endpoint expecting two different
    // things under similar-sounding names: the Analytics page's "Extractions
    // Run" / "Leads Found" cards are genuine all-time totals, while the
    // Dashboard's "This Month" row needs the same shape scoped to the
    // current calendar month. Rather than repurpose one set of fields for
    // both (which would silently make one of the two callers wrong), the
    // all-time totalX fields stay all-time and a parallel monthlyX set
    // covers the current month, each on its own row's own timestamp
    // (a session's startedAt, a lead's or enrichment log's
    // createdAt/enrichedAt) since a lead or a retry can land in a later
    // month than the session that first found it. recentSessions stays
    // unscoped either way, it feeds a "recent activity" list, not a count.
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalExtractions,
      totalLeadsFound,
      totalEmailsVerified,
      phoneCount,
      totalEnrichmentRuns,
      monthlyExtractions,
      monthlyLeadsFound,
      monthlyEmailsVerified,
      monthlyPhoneCount,
      monthlyEnrichmentRuns,
      recentSessions,
    ] = await Promise.all([
      prisma.scrapeSession.count({ where: { userId } }),
      // Real BusinessLead row count, not the sum of each session's totalYield
      // counter (which drifts once history-wide dedup drops repeats).
      prisma.businessLead.count({ where: { session: { userId } } }),
      prisma.businessLead.count({ where: { session: { userId }, emailVerified: true } }),
      prisma.businessLead.count({ where: { session: { userId }, phone: { not: null } } }),
      // Enrichment log rows: one per attempt, so this can exceed the lead
      // count when leads are retried. It is "runs", not "leads enriched".
      prisma.enrichmentLog.count({ where: { lead: { session: { userId } } } }),
      prisma.scrapeSession.count({ where: { userId, startedAt: { gte: startOfMonth } } }),
      prisma.businessLead.count({ where: { session: { userId }, createdAt: { gte: startOfMonth } } }),
      prisma.businessLead.count({
        where: { session: { userId }, emailVerified: true, createdAt: { gte: startOfMonth } },
      }),
      prisma.businessLead.count({
        where: { session: { userId }, phone: { not: null }, createdAt: { gte: startOfMonth } },
      }),
      prisma.enrichmentLog.count({
        where: { lead: { session: { userId } }, enrichedAt: { gte: startOfMonth } },
      }),
      prisma.scrapeSession.findMany({
        where: { userId },
        select: { id: true, query: true, totalYield: true, status: true, startedAt: true, duration: true },
        orderBy: { startedAt: "desc" },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      totalExtractions,
      totalLeadsFound,
      totalEmailsVerified,
      phoneCount,
      totalEnrichmentRuns,
      // Kept for any older caller still reading it, same value as the runs count.
      totalEnriched: totalEnrichmentRuns,
      monthlyExtractions,
      monthlyLeadsFound,
      monthlyEmailsVerified,
      monthlyPhoneCount,
      monthlyEnrichmentRuns,
      recentSessions,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
