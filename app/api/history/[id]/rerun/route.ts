import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  return NextResponse.json({
    status: "rerun_queued",
    config: {
      keyword: session.query,
      location: session.location,
      radius: "25",
      concurrency: 8,
      proxyType: "residential",
      enrichmentDepth: "standard",
      maxResults: session.totalYield ?? 100,
    },
  });
}
