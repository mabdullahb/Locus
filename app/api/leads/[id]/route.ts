import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const lead = await prisma.businessLead.findUnique({
    where: { id },
    include: {
      session: { select: { userId: true, query: true } },
      enrichmentLogs: { orderBy: { enrichedAt: "desc" } },
    },
  });

  if (!lead || lead.session.userId !== userId) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: lead.id,
    businessName: lead.businessName,
    location: lead.location,
    phone: lead.phone,
    email: lead.email,
    emailVerified: lead.emailVerified,
    website: lead.website,
    category: lead.category,
    status: lead.status,
    createdAt: lead.createdAt,
    timesSeen: lead.timesSeen,
    lastSeenAt: lead.lastSeenAt,
    searchQuery: lead.session.query,
    enrichmentLogs: lead.enrichmentLogs.map((log) => ({
      id: log.id,
      source: log.source,
      resultStatus: log.resultStatus,
      emailFound: log.emailFound,
      errorMessage: log.errorMessage,
      enrichedAt: log.enrichedAt,
    })),
  });
}
