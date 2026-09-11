import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";
import { isRateLimitError } from "@/lib/enrichment";

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  try {
    const [totalLogs, successfulLogs, methodCounts, failedLeads, pendingCount] = await Promise.all([
      prisma.enrichmentLog.count({ where: { lead: { session: { userId } } } }),
      prisma.enrichmentLog.count({
        where: { lead: { session: { userId } }, emailFound: true },
      }),
      prisma.enrichmentLog.groupBy({
        by: ["source"],
        where: { lead: { session: { userId } } },
        _count: true,
      }),
      prisma.businessLead.findMany({
        where: { session: { userId }, status: "failed" },
        select: {
          id: true,
          businessName: true,
          location: true,
          status: true,
          enrichmentLogs: {
            select: { errorMessage: true, enrichedAt: true },
            orderBy: { enrichedAt: "desc" },
            take: 1,
          },
        },
        take: 50,
        orderBy: { createdAt: "desc" },
      }),
      // Leads that never had an enrichment attempt at all (usually from a
      // session aborted before its enrichment loop started) — distinct from
      // "failed", which means an attempt ran and errored.
      prisma.businessLead.count({ where: { session: { userId }, status: "pending" } }),
    ]);

    const methodBreakdown: Record<string, number> = {};
    for (const mc of methodCounts) {
      methodBreakdown[mc.source] = mc._count;
    }

    const failedLeadsWithError = failedLeads.map(({ enrichmentLogs, ...lead }) => {
      const lastError = enrichmentLogs[0]?.errorMessage ?? null;
      return {
        ...lead,
        errorMessage: lastError,
        isRateLimited: isRateLimitError(lastError),
      };
    });

    const rateLimitedCount = failedLeadsWithError.filter((l) => l.isRateLimited).length;

    return NextResponse.json({
      totalEnriched: totalLogs,
      successfulEnrichments: successfulLogs,
      successRate: totalLogs > 0 ? Math.round((successfulLogs / totalLogs) * 100) : 0,
      methodBreakdown,
      failedLeads: failedLeadsWithError,
      rateLimitedCount,
      pendingCount,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch enrichment stats" }, { status: 500 });
  }
}
