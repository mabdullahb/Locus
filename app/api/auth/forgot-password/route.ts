import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-client-ip";
import { generateResetToken, resetTokenExpiry } from "@/lib/auth/password-reset";
import { sendPasswordResetEmail } from "@/lib/email";
import { parseJsonBody, InvalidJsonError } from "@/lib/parse-json-body";

// Always responds { ok: true } whether or not the email maps to an account. A
// different response for "no such user" would let anyone probe which emails
// are registered.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  try {
    const { email: rawEmail } = await parseJsonBody<{ email?: string }>(req);
    if (!rawEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailKey = rawEmail.trim().toLowerCase();
    const ipOk = checkRateLimit(`forgot-ip:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
    const emailOk = checkRateLimit(`forgot-email:${emailKey}`, { limit: 5, windowMs: 15 * 60 * 1000 });
    if (!ipOk || !emailOk) {
      return NextResponse.json(
        { error: "Too many reset requests. Please try again in 15 minutes." },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email: emailKey } });

    if (user) {
      // Clear earlier unused tokens so a user cannot stack several live links,
      // and so an older link stops working once a newer one is requested.
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });

      const { token, tokenHash } = generateResetToken();
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: resetTokenExpiry() },
      });

      const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const link = `${base}/reset-password?token=${token}`;
      const sent = await sendPasswordResetEmail(user.email, link);
      if (!sent.ok) {
        console.error(`[forgot-password] email send failed: ${sent.error}`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof InvalidJsonError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not process the request" }, { status: 500 });
  }
}
