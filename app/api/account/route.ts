import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  try {
    const { name, email, currentPassword } = (await req.json()) as {
      name?: string;
      email?: string;
      currentPassword?: string;
    };

    const data: { name?: string; email?: string } = {};
    if (typeof name === "string" && name.trim()) data.name = name.trim();

    const trimmedEmail = typeof email === "string" ? email.trim() : undefined;
    if (trimmedEmail) {
      const existing = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, password: true } });
      if (!existing) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      // Email is what forgot-password and login use to identify the account,
      // so changing it is as sensitive as changing the password itself. An
      // attacker riding a hijacked session (see the password-change route's
      // other-session revocation) shouldn't be able to silently repoint it
      // to an address they control and take the account over from there.
      if (trimmedEmail.toLowerCase() !== existing.email.toLowerCase()) {
        if (!existing.password) {
          return NextResponse.json({ error: "This account has no password set" }, { status: 400 });
        }
        if (!currentPassword || !(await compare(currentPassword, existing.password))) {
          return NextResponse.json(
            { error: "Current password is required to change your email" },
            { status: 400 },
          );
        }
      }
      // Stored lowercase, same canonical form register and login already use
      // (lib/auth.ts, app/api/register/route.ts), so a login lookup by
      // lowercased email still matches after this change.
      data.email = trimmedEmail.toLowerCase();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({ user });
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((err as any)?.code === "P2002") {
      return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  try {
    const { confirmEmail, password } = (await req.json()) as { confirmEmail?: string; password?: string };

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, password: true } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!confirmEmail || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Type your account email exactly to confirm deletion" },
        { status: 400 },
      );
    }
    if (!user.password) {
      return NextResponse.json({ error: "This account has no password set" }, { status: 400 });
    }
    if (!password || !(await compare(password, user.password))) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 400 });
    }

    // Delete children that don't cascade automatically, in dependency order.
    // Account, Session, UserSession, WebhookConfig, and ConnectorConfig all
    // have onDelete: Cascade on User, so the final user.delete() cleans
    // those up on its own.
    await prisma.$transaction([
      prisma.enrichmentLog.deleteMany({ where: { lead: { session: { userId } } } }),
      prisma.businessLead.deleteMany({ where: { session: { userId } } }),
      prisma.proxySession.deleteMany({ where: { session: { userId } } }),
      prisma.exportHistory.deleteMany({ where: { userId } }),
      prisma.scrapeSession.deleteMany({ where: { userId } }),
      prisma.userApiKey.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    return NextResponse.json({ message: "Account deleted" });
  } catch {
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
