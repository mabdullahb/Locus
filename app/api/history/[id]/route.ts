import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const session = await prisma.scrapeSession.findUnique({
    where: { id },
  });

  if (!session || session.userId !== userId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const [grouped, enriched] = await Promise.all([
    prisma.businessLead.groupBy({
      by: ["sessionId"],
      where: { sessionId: session.id },
      _count: { email: true, phone: true },
    }),
    prisma.enrichmentLog.count({ where: { emailFound: true, lead: { sessionId: session.id } } }),
  ]);

  return NextResponse.json({
    id: session.id,
    query: session.query,
    location: session.location,
    status: session.status,
    yield: {
      leads: session.totalYield ?? 0,
      emails: grouped[0]?._count?.email ?? 0,
      phones: grouped[0]?._count?.phone ?? 0,
      enriched,
    },
    config: {
      keyword: session.query,
      location: session.location,
      radius: session.radius,
      concurrency: session.concurrency,
      proxyType: session.proxyType,
      enrichmentDepth: (session.config as Record<string, unknown> | null)?.enrichmentDepth as string ?? "standard",
      maxResults: session.totalYield ?? 100,
      locale: (session.config as Record<string, unknown> | null)?.locale as string ?? "en-US",
    },
    startedAt: session.startedAt.getTime(),
    completedAt: session.completedAt?.getTime() ?? null,
    duration: session.duration,
    errorLog: session.errorLog,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const session = await prisma.scrapeSession.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!session || session.userId !== userId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // None of these relations cascade from ScrapeSession, so delete the
  // dependent rows first, in one transaction, before the session itself.
  await prisma.$transaction([
    prisma.enrichmentLog.deleteMany({ where: { lead: { sessionId: id } } }),
    prisma.businessLead.deleteMany({ where: { sessionId: id } }),
    prisma.exportHistory.deleteMany({ where: { sessionId: id } }),
    prisma.proxySession.deleteMany({ where: { sessionId: id } }),
    prisma.scrapeSession.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
