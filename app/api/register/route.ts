import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-client-ip";
import { parseJsonBody, InvalidJsonError } from "@/lib/parse-json-body";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    if (!checkRateLimit(`register:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again in 15 minutes." },
        { status: 429 },
      );
    }

    const { name, email: rawEmail, password } = await parseJsonBody<{
      name: string;
      email: string;
      password: string;
    }>(req);

    if (!rawEmail || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 },
      );
    }

    // Store one canonical form so "Test@X.com" and "test@x.com" are the same
    // account, and lookups at login match regardless of how it was typed.
    const email = rawEmail.trim().toLowerCase();

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // A distinct 409 plus "Email already registered" let anyone probe
      // this endpoint to enumerate which emails have accounts. Returning
      // the same 200 shape as a genuine signup, with no new row created,
      // closes that off: the frontend immediately attempts signIn() with
      // whatever password was just typed, which fails naturally on a wrong
      // password for an existing account and succeeds naturally for a real
      // new signup, with nothing in this response telling the caller which
      // case they hit. The dummy hash keeps response time from becoming its
      // own side channel (a real signup pays for a real bcrypt hash here,
      // so this path pays the same cost instead of returning early).
      await hash(password, 12);
      return NextResponse.json({ email });
    }

    const hashedPassword = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: name || email.split("@")[0],
        email,
        password: hashedPassword,
      },
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (err) {
    if (err instanceof InvalidJsonError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
