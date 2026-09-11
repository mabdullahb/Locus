import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";

export async function POST(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const session = await prisma.scrapeSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "running") {
    return NextResponse.json({ error: "Session is not running" }, { status: 400 });
  }

  // Cooperative cancellation: the worker (server/index.ts) checks this status
  // before starting and periodically during the enrichment loop, and stops
  // early once it sees anything other than "running". No direct BullMQ access
  // needed from this process.
  await prisma.scrapeSession.update({
    where: { id: sessionId },
    data: { status: "aborted", completedAt: new Date() },
  });

  return NextResponse.json({ message: "Session cancelled" });
}
