import { NextRequest, NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";
import { parseJsonBody, InvalidJsonError } from "@/lib/parse-json-body";

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentSessionId = (session as any)?.sessionId as string | null | undefined;

  try {
    const { currentPassword, newPassword } = await parseJsonBody<{
      currentPassword?: string;
      newPassword?: string;
    }>(req);

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current and new password are required" },
        { status: 400 },
      );
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.password) {
      return NextResponse.json(
        { error: "This account has no password set" },
        { status: 400 },
      );
    }

    const isValid = await compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const hashedPassword = await hash(newPassword, 12);
    // Revoke every other device session on a password change so a stolen or
    // shared-device session that's still logged in loses access the moment
    // the real owner notices and changes their password, same as the
    // forgot-password recovery flow already does. The session used to make
    // this request stays valid, otherwise this request would end up logging
    // its own caller out.
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } }),
      prisma.userSession.updateMany({
        where: { userId, revoked: false, ...(currentSessionId ? { id: { not: currentSessionId } } : {}) },
        data: { revoked: true },
      }),
    ]);

    return NextResponse.json({ message: "Password updated" });
  } catch (err) {
    if (err instanceof InvalidJsonError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }
}
