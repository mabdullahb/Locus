import { test, expect, chromium } from "@playwright/test";
import { Client } from "pg";

// This test registers a real throwaway account on every run and never
// deleted it, so 19 "session-revocation-<timestamp>@example.com" rows had
// piled up in the real Admin > Users list by the time anyone noticed. Uses
// `pg` directly rather than the generated Prisma client, same reason
// global-setup.ts does: that client is CJS-shaped in a way that doesn't
// load under Playwright's own TS runner.
let createdUserId: string | null = null;

test.afterEach(async () => {
  if (!createdUserId) return;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('DELETE FROM "User" WHERE id = $1', [createdUserId]);
  } finally {
    await client.end();
    createdUserId = null;
  }
});

// Regression test for a real next-auth v4 to v5 migration bug: revoking a
// device session left that device still authenticated. Root cause was
// returning `null` from the `session()` callback in lib/auth.ts to signal
// "revoked" - next-auth v5's server-side auth()/getSession() wraps a custom
// session() callback as `(await callbacks.session(...)) ?? <fallback
// session>` (node_modules/next-auth/lib/index.js), so the `null` was
// silently coalesced back into a valid-looking session. The fix moved the
// revocation check into the `jwt()` callback instead, which @auth/core's own
// session action (node_modules/@auth/core/lib/actions/session.js) correctly
// treats as "no session" when it returns null.
//
// This test starts with an empty (unauthenticated) storage state rather than
// the shared global-setup session, since it needs two independently
// authenticated "devices" on one fresh account.
test.use({ storageState: { cookies: [], origins: [] } });

test("revoking a device session logs that device out immediately", async ({ baseURL }) => {
  const email = `session-revocation-${Date.now()}@example.com`;
  const password = "RealPassword123!";

  const registerRes = await fetch(`${baseURL}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Session Revocation Test", email, password }),
  });
  const registerBody = await registerRes.json();
  createdUserId = registerBody.id ?? null;

  const browser = await chromium.launch();

  async function loginNewDevice() {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 8000 });
    return page;
  }

  const deviceA = await loginNewDevice();
  const deviceB = await loginNewDevice();

  const { sessions } = await deviceA.evaluate(() => fetch("/api/account/sessions").then((r) => r.json()));
  const deviceBSession = sessions.find((s: { current: boolean }) => !s.current);
  expect(deviceBSession).toBeTruthy();

  const revokeStatus = await deviceA.evaluate(
    (id) => fetch(`/api/account/sessions?id=${id}`, { method: "DELETE" }).then((r) => r.status),
    deviceBSession.id
  );
  expect(revokeStatus).toBe(200);

  const deviceBCheckStatus = await deviceB.evaluate(() =>
    fetch("/api/account/session-check").then((r) => r.status)
  );
  expect(deviceBCheckStatus).toBe(401);

  await deviceB.goto("/dashboard", { waitUntil: "networkidle" });
  expect(deviceB.url()).toContain("/login");

  await browser.close();
});
