import { test, expect, chromium } from "@playwright/test";
import { Client } from "pg";
import { encode } from "next-auth/jwt";
import dotenv from "dotenv";

dotenv.config();

// A dedicated throwaway user with exactly two sessions, rather than adding
// a second session to the shared e2e-suite-user fixture other specs rely
// on (table row counts, etc.), same isolation reasoning as
// bulk-search.spec.ts's own throwaway account.
let userId: string | null = null;

test.afterEach(async () => {
  if (!userId) return;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('DELETE FROM "BusinessLead" WHERE "sessionId" IN (SELECT id FROM "ScrapeSession" WHERE "userId" = $1)', [userId]);
    await client.query('DELETE FROM "ScrapeSession" WHERE "userId" = $1', [userId]);
    await client.query('DELETE FROM "User" WHERE id = $1', [userId]);
  } finally {
    await client.end();
    userId = null;
  }
});

test.use({ storageState: { cookies: [], origins: [] } });

test("Session compare modal has no critical/serious accessibility violations while open", async ({ baseURL }) => {
  userId = `compare-a11y-${Date.now()}`;
  const email = `${userId}@example.com`;

  const connectionString = process.env.DATABASE_URL!;
  const client = new Client({ connectionString });
  await client.connect();
  const sessionAId = `${userId}-a`;
  const sessionBId = `${userId}-b`;
  try {
    await client.query(
      'INSERT INTO "User" (id, email, name, "isAdmin", "createdAt", "updatedAt") VALUES ($1, $2, $3, false, now(), now())',
      [userId, email, "compare a11y test"],
    );
    for (const [id, query] of [[sessionAId, "coffee shops"], [sessionBId, "bakeries"]] as const) {
      await client.query(
        `INSERT INTO "ScrapeSession" (id, "userId", query, location, radius, concurrency, "proxyType", status, "totalYield", "startedAt", "completedAt", duration, config)
         VALUES ($1, $2, $3, 'Seattle, WA', '10', 8, 'residential', 'completed', 1, now(), now(), 60, '{}'::jsonb)`,
        [id, userId, query],
      );
    }
  } finally {
    await client.end();
  }

  const cookieName = "authjs.session-token";
  const token = await encode({ token: { id: userId, email, name: email }, secret: process.env.NEXTAUTH_SECRET!, salt: cookieName });

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  await context.addCookies([{ name: cookieName, value: token, domain: new URL(baseURL!).hostname, path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();

  await page.goto("/history", { waitUntil: "networkidle" });
  const checkboxes = page.locator('tbody input[type="checkbox"]');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByRole("heading", { name: "Compare sessions" })).toBeVisible();

  const AxeBuilder = (await import("@axe-core/playwright")).default;
  const results = await new AxeBuilder({ page }).analyze();
  const failing = results.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
  if (failing.length > 0) {
    const summary = failing.map((v) => `${v.impact}: ${v.id} — ${v.help} (${v.nodes.length} element(s))`).join("\n");
    throw new Error(`Accessibility violations in the open Compare modal:\n${summary}`);
  }

  await browser.close();
});
