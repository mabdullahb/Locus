import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentSessionId = (session as any)?.sessionId as string | null | undefined;

  const sessions = await prisma.userSession.findMany({
    where: { userId, revoked: false },
    orderBy: { lastSeenAt: "desc" },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      device: s.device,
      ip: s.ip,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      current: s.id === currentSessionId,
    })),
  });
}

export async function DELETE(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param required" }, { status: 400 });
  }

  const target = await prisma.userSession.findUnique({ where: { id } });
  if (!target || target.userId !== userId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Capture before revoking. Revoking your own session makes the very next
  // auth() call return null (that's the whole point), so reading it after
  // would always report revokedCurrent: false even when it was true.
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentSessionId = (session as any)?.sessionId as string | null | undefined;

  await prisma.userSession.update({ where: { id }, data: { revoked: true } });

  return NextResponse.json({ message: "Session revoked", revokedCurrent: id === currentSessionId });
}
