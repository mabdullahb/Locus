import { chromium, type FullConfig } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { Client } from "pg";
import dotenv from "dotenv";

// Next.js auto-loads .env; a standalone Playwright script does not.
dotenv.config();

// Crafts a signed NextAuth session cookie directly (same mechanism NextAuth
// itself uses) instead of driving a real login form. There's no dedicated
// test account with a known password, and this avoids adding one just for
// e2e auth. Only ever touches whichever account E2E_USER_ID/EMAIL point at.
// Takes the id directly rather than looking it up via Prisma here. The
// generated Prisma client is CJS-shaped in a way that doesn't load under
// Playwright's own TS runner (works fine under Next.js's bundler, which is
// a different module pipeline). Seeding below uses the `pg` driver directly
// for the same reason.
//
// CI's placeholder user (E2E_USER_ID with no real User row) meant every
// authenticated e2e check, including the accessibility suite, only ever
// tested empty-state pages: stat boxes showing 0, an empty leads table. A
// real WCAG "serious" color-contrast violation on populated stat captions
// went undetected for exactly this reason, the class of bug only exists
// once real data renders. seedRealisticDataIfNeeded closes that gap. If the
// target user doesn't already exist (true for CI's fresh, empty Postgres
// container each run, false for a real local account, which is left
// alone), it creates the user plus one small, realistic session and a few
// leads.
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || "http://localhost:3000";
  const email = process.env.E2E_USER_EMAIL;
  const userId = process.env.E2E_USER_ID;
  if (!email || !userId) {
    console.warn(
      "E2E_USER_EMAIL/E2E_USER_ID not set — skipping authenticated storage state. " +
        "Tests that require login will fail.",
    );
    return;
  }

  // v5 renamed the default session cookie from next-auth.* to authjs.*, and
  // encode() now requires salt (Auth.js derives a per-cookie key from it),
  // conventionally the cookie's own name, same as the rest of the library
  // does internally.
  const cookieName = "authjs.session-token";
  const token = await encode({
    token: { id: userId, email, name: email },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: cookieName,
  });

  await seedRealisticDataIfNeeded(userId, email);

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: cookieName,
      value: token,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await context.storageState({ path: "tests/e2e/.auth-state.json" });
  await browser.close();
}

async function seedRealisticDataIfNeeded(userId: string, email: string) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const existing = await client.query('SELECT id FROM "User" WHERE id = $1', [userId]);
    if ((existing.rowCount ?? 0) > 0) return;

    // isAdmin: true so the seeded e2e user can exercise admin-only pages
    // (e.g. the Admin users table alignment test) without a second,
    // separately-seeded account. This is a throwaway CI/local test user,
    // not a real account, so granting it admin has no real-world exposure.
    await client.query(
      'INSERT INTO "User" (id, email, name, "isAdmin", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, now(), now())',
      [userId, email, email.split("@")[0]],
    );

    const sessionId = `${userId}-e2e-seed-session`;
    await client.query(
      `INSERT INTO "ScrapeSession"
        (id, "userId", query, location, radius, concurrency, "proxyType", status, "totalYield", "startedAt", "completedAt", duration, config)
       VALUES ($1, $2, 'coffee shops', 'Seattle, WA', '10', 8, 'residential', 'completed', 3, now() - interval '1 hour', now(), 120, '{}'::jsonb)`,
      [sessionId, userId],
    );

    // Inserted in reverse of desired display order: the table's default sort
    // is createdAt desc (newest first), and each row gets its own now() at
    // insert time, so the last one inserted shows up first. Failed goes in
    // first (oldest, ends up last on screen) and verified goes in last
    // (newest, ends up first), so a fresh view leads with the good outcome
    // rather than a failure.
    const leads: [string, string, string, string, string, boolean][] = [
      [`${sessionId}-lead-3`, "Third Wave Roasters", "789 Oak Ave, Seattle, WA", "", "failed", false],
      [`${sessionId}-lead-2`, "Second Cup Cafe", "456 Pine St, Seattle, WA", "", "needs_enrich", false],
      [`${sessionId}-lead-1`, "Example Coffee Co", "123 Main St, Seattle, WA", "hello@example.com", "verified", true],
    ];
    for (const [id, businessName, location, leadEmail, status, emailVerified] of leads) {
      await client.query(
        `INSERT INTO "BusinessLead"
          (id, "sessionId", "businessName", location, phone, email, "emailVerified", status, "createdAt")
         VALUES ($1, $2, $3, $4, '+1 206-555-0100', $5, $6, $7::"LeadStatus", now())`,
        [id, sessionId, businessName, location, leadEmail || null, emailVerified, status],
      );
    }
  } finally {
    await client.end();
  }
}

export default globalSetup;
