import NextAuth from "next-auth";
import { CredentialsSignin } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-client-ip";
import authConfig from "@/lib/auth.config";

// v5 only recognizes typed CredentialsSignin errors thrown from authorize().
// A plain `throw new Error(...)` gets swallowed into a generic "Configuration"
// error client-side (confirmed live, signIn() returned error "Configuration"
// for every authorize() failure after the v4 to v5 migration). Each subclass's
// `code` lands in the client-side signIn() result and lets the login page
// show the right message instead of one generic string for every failure.
class MissingCredentialsError extends CredentialsSignin {
  code = "missing-credentials";
}
class RateLimitedError extends CredentialsSignin {
  code = "rate-limited";
}
class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid-credentials";
}

function parseDeviceLabel(userAgent: string | undefined): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent.toLowerCase();

  let os = "Unknown OS";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os") || ua.includes("macintosh")) os = "macOS";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("linux")) os = "Linux";

  let browser = "Unknown browser";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/") && !ua.includes("chromium")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/") && !ua.includes("chrome")) browser = "Safari";

  return `${browser} on ${os}`;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma as any),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // v5's authorize gets the real Web API Request as its second
      // argument (confirmed against @auth/core's shipped types), unlike
      // v4's plain headers object, so header access goes through
      // request.headers.get(...) instead of bracket access.
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          throw new MissingCredentialsError();
        }

        // Rate limit by IP (blocks a single attacker hammering many
        // accounts) and separately by email (blocks a distributed attack
        // targeting one specific account across many IPs).
        const loginIp = getClientIp(request.headers);
        const emailKey = String(credentials.email).trim().toLowerCase();
        const ipOk = checkRateLimit(`login-ip:${loginIp}`, { limit: 20, windowMs: 15 * 60 * 1000 });
        const emailOk = checkRateLimit(`login-email:${emailKey}`, { limit: 10, windowMs: 15 * 60 * 1000 });
        if (!ipOk || !emailOk) {
          throw new RateLimitedError();
        }

        const user = await prisma.user.findUnique({
          where: { email: emailKey },
        });

        if (!user || !user.password) {
          throw new InvalidCredentialsError();
        }

        const isValid = await compare(String(credentials.password), user.password);
        if (!isValid) {
          throw new InvalidCredentialsError();
        }

        const userAgent = request.headers.get("user-agent") || undefined;
        const forwardedFor = request.headers.get("x-forwarded-for");
        const ip = forwardedFor?.split(",")[0]?.trim() || null;

        const deviceSession = await prisma.userSession.create({
          data: {
            userId: user.id,
            device: parseDeviceLabel(userAgent),
            userAgent: userAgent || null,
            ip,
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          sessionId: deviceSession.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      },
    }),
  ],
  callbacks: {
    // The revocation check lives here, not in the session() callback below.
    // next-auth v5's server-side auth()/getSession() wraps a custom session()
    // callback's result as `(await callbacks.session(...)) ?? <fallback
    // session>` (node_modules/next-auth/lib/index.js), so a `null` returned
    // from session() to signal "revoked" gets silently coalesced back into a
    // valid-looking session by that `??`, and the device stays logged in.
    // Confirmed live: revoking a device session left session-check still
    // returning 200 for that device. Returning `null` from jwt() instead is
    // handled correctly by @auth/core's own session action
    // (node_modules/@auth/core/lib/actions/session.js), which skips calling
    // session() entirely and clears the cookie when jwt() returns null.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.sessionId = (user as any).sessionId;
        return token;
      }

      // Sessions issued before this feature existed carry no sessionId.
      // Let them keep working rather than logging everyone out on rollout.
      const sessionId = token.sessionId as string | undefined;
      if (sessionId) {
        const deviceSession = await prisma.userSession.findUnique({ where: { id: sessionId } });
        if (!deviceSession || deviceSession.revoked) {
          return null;
        }
        prisma.userSession
          .update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } })
          .catch(() => {});
      }

      return token;
    },
    async session({ session, token }) {
      const sessionId = token.sessionId as string | undefined;

      // Read isAdmin fresh from the DB on every session check, rather than
      // baking it into the JWT at login. This is UI-display only (every API
      // route re-verifies isAdmin server-side regardless), but reading it
      // fresh means revoking admin access takes effect immediately instead
      // of surviving until the JWT's 30-day expiry.
      const dbUser = token.id
        ? await prisma.user.findUnique({ where: { id: token.id as string }, select: { isAdmin: true } })
        : null;

      const isAdmin = dbUser?.isAdmin ?? false;

      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).id = token.id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).isAdmin = isAdmin;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).sessionId = sessionId ?? null;
      return session;
    },
  },
});
