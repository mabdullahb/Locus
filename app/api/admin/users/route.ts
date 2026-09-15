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

  // Same re-verification as /api/admin/stats — never trust the session
  // claim alone for access to every user's email address.
  const requester = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!requester?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      createdAt: true,
      _count: { select: { scrapeSessions: true } },
    },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isAdmin: u.isAdmin,
      createdAt: u.createdAt,
      extractionCount: u._count.scrapeSessions,
    })),
  });
}
