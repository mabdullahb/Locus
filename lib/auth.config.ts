import type { NextAuthConfig } from "next-auth";

// Lightweight base config, imported by proxy.ts (Next.js 16's middleware
// replacement). No CredentialsProvider, no adapter, no Prisma-touching
// callbacks here, kept separate on purpose. proxy.ts runs on every route
// including prefetches, so Next.js's own guidance is to keep it to
// optimistic, cookie-only checks rather than direct database queries. This
// config only needs to answer "is there a validly signed, unexpired session
// JWT", which is what req.auth being truthy already gives it with no
// providers configured at all. The real provider, adapter, and callbacks
// live in lib/auth.ts, which imports and extends this config for every
// other use.
//
// The real revocation check (a valid JWT whose device session has since
// been revoked) happens via a fetch to /api/account/session-check from
// proxy.ts, a genuine Node.js route that can reach Postgres, rather than a
// direct Prisma call in proxy.ts itself.
export default {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  providers: [],
  // Auth.js only auto-trusts the incoming Host header on platforms it can
  // detect itself (Vercel). Everywhere else, including a plain `next start`
  // (confirmed live: every authenticated page 500'd with `UntrustedHost`
  // under a production build, this never showed up under `next dev`, which
  // is more lenient), it refuses to resolve a session unless trustHost is
  // explicitly set. Safe here because the app is meant to run behind a
  // reverse proxy that sets Host correctly, the same deployment assumption
  // TRUST_PROXY_HEADERS in .env.example already documents for rate
  // limiting, not safe if this is ever exposed directly to the internet
  // with an untrusted Host header able to reach it unfiltered.
  trustHost: true,
} satisfies NextAuthConfig;
