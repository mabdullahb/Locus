import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";
import { NextResponse } from "next/server";

// Page routes get an extra revocation check on top of auth()'s JWT-presence
// gate: a revoked session (Settings > Security) still carries a validly
// signed, unexpired JWT, so req.auth alone would let it through. API routes
// skip this, they already call auth() themselves (via requireUserId()),
// which runs the same revocation check in lib/auth.ts's session callback,
// so double-checking here would just add latency.
//
// The revocation check goes through a fetch to a separate API route rather
// than a direct Prisma call here, and that's deliberate, not just a leftover
// from when middleware ran on the Edge runtime (which really did require
// this split). Next.js's own guidance for proxy.ts is to keep it to
// optimistic, cookie-only checks and avoid direct database queries, since
// proxy runs on every route including prefetches, unlike an ordinary page or
// API route hit once per real navigation. A Prisma query here would run on
// every prefetch too. lib/auth.config.ts (the lightweight base config this
// builds its own NextAuth instance from) stays separate from lib/auth.ts's
// full config for the same reason.
const { auth } = NextAuth(authConfig);

export default auth(async (req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const checkUrl = new URL("/api/account/session-check", req.url);
  const check = await fetch(checkUrl, {
    headers: { cookie: req.headers.get("cookie") || "" },
  }).catch(() => null);

  if (!check || !check.ok) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/history/:path*",
    "/settings/:path*",
    "/integrations/:path*",
    "/enrichment/:path*",
    "/analytics/:path*",
    "/api-keys/:path*",
    "/proxy/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/leads/:path*",
    "/api/scrape/:path*",
    "/api/history/:path*",
    "/api/export/:path*",
    "/api/enrich/:path*",
    "/api/settings/:path*",
    "/api/enrichment/:path*",
    "/api/analytics/:path*",
  ],
};
