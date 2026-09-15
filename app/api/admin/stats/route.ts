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

  // Never trust the session's isAdmin claim for access to real data — the
  // sidebar link being hidden for non-admins is a UX nicety, not a security
  // boundary. Re-verify server-side against the DB, same as every other
  // permission check in this app.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [totalUsers, totalExtractions, totalEnrichmentAttempts, successfulEnrichments] = await Promise.all([
    prisma.user.count(),
    prisma.scrapeSession.count(),
    prisma.enrichmentLog.count(),
    prisma.enrichmentLog.count({ where: { emailFound: true } }),
  ]);

  const enrichmentSuccessRate = totalEnrichmentAttempts > 0
    ? Math.round((successfulEnrichments / totalEnrichmentAttempts) * 1000) / 10
    : 0;

  return NextResponse.json({
    totalUsers,
    totalExtractions,
    totalEnrichmentAttempts,
    successfulEnrichments,
    enrichmentSuccessRate,
  });
}
