import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";
import type { ScrapeSessionWhereInput } from "@/lib/generated/prisma/models";
import { SessionStatus } from "@/lib/generated/prisma/enums";

const SESSION_STATUS_VALUES: readonly string[] = Object.values(SessionStatus);

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "25")));

  try {
    const where: ScrapeSessionWhereInput = { userId };
    if (status && status !== "all" && SESSION_STATUS_VALUES.includes(status)) {
      where.status = status as SessionStatus;
    }
    if (search) {
      where.OR = [
        { query: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, sessions] = await Promise.all([
      prisma.scrapeSession.count({ where }),
      prisma.scrapeSession.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { businessLeads: true } },
        },
      }),
    ]);

    const sessionIds = sessions.map((s) => s.id);
    const leadCounts = sessionIds.length > 0
      ? await Promise.all(
          sessionIds.map(async (id) => {
            const [grouped, enriched] = await Promise.all([
              prisma.businessLead.groupBy({
                by: ["sessionId"],
                where: { sessionId: id },
                _count: { email: true, phone: true },
              }),
              prisma.enrichmentLog.count({ where: { emailFound: true, lead: { sessionId: id } } }),
            ]);
            return {
              id,
              emails: grouped[0]?._count?.email ?? 0,
              phones: grouped[0]?._count?.phone ?? 0,
              enriched,
            };
          })
        )
      : [];

    const countsMap = new Map(leadCounts.map((c) => [c.id, c]));
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return NextResponse.json({
      sessions: sessions.map((s) => {
        const c = countsMap.get(s.id);
        return {
          id: s.id,
          query: s.query,
          location: s.location,
          status: s.status,
          yield: {
            leads: s.totalYield ?? 0,
            emails: c?.emails ?? 0,
            phones: c?.phones ?? 0,
            enriched: c?.enriched ?? 0,
          },
          config: {
            keyword: s.query,
            location: s.location,
            radius: s.radius,
            concurrency: s.concurrency,
            proxyType: s.proxyType,
            enrichmentDepth: (s.config as Record<string, unknown> | null)?.enrichmentDepth as string ?? "standard",
            maxResults: s.totalYield ?? 100,
            locale: (s.config as Record<string, unknown> | null)?.locale as string ?? "en-US",
          },
          startedAt: s.startedAt.getTime(),
          completedAt: s.completedAt?.getTime() ?? null,
          duration: s.duration,
          errorLog: s.errorLog,
        };
      }),
      total,
      totalPages,
      currentPage: Math.min(page, totalPages),
      pageSize,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
