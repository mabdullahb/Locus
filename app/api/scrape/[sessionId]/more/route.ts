import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";
import { internalSecretHeaders } from "@/lib/internal-auth";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";

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

  const config = (session.config as Record<string, unknown>) || {};
  if (!config.hasMore) {
    return NextResponse.json({ error: "No more results available for this search" }, { status: 400 });
  }

  // Atomic check-then-set: if two "Load more" clicks race, only the one that
  // actually flips completed -> running wins; the loser gets count=0 and
  // knows a job is already in flight instead of enqueueing a second one that
  // would process the same continuation state concurrently.
  const { count } = await prisma.scrapeSession.updateMany({
    where: { id: sessionId, status: "completed" },
    data: { status: "running" },
  });
  if (count === 0) {
    return NextResponse.json({ error: "Session is not ready for another batch" }, { status: 409 });
  }

  try {
    const expressRes = await fetch(`${SERVER_URL}/api/scrape/more`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalSecretHeaders() },
      body: JSON.stringify({ sessionId: sessionId, userId }),
    });
    if (!expressRes.ok) {
      await prisma.scrapeSession.update({ where: { id: sessionId }, data: { status: "completed" } });
      return NextResponse.json({ error: "Extraction service unavailable — please try again later." }, { status: 503 });
    }
  } catch {
    await prisma.scrapeSession.update({ where: { id: sessionId }, data: { status: "completed" } });
    return NextResponse.json({ error: "Extraction service unavailable — please try again later." }, { status: 503 });
  }

  return NextResponse.json({ sessionId: sessionId, status: "queued" });
}
