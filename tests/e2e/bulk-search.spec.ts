import { test, expect, chromium } from "@playwright/test";
import { Client } from "pg";
import AxeBuilder from "@axe-core/playwright";

// Fresh throwaway account per run, cleaned up after, same pattern as
// session-revocation.spec.ts (that test's own comment explains why: 19
// leftover accounts piled up in the real Admin > Users list once before
// from a test that registered but never cleaned up after itself).
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

test.use({ storageState: { cookies: [], origins: [] } });

test("bulk CSV upload queues real search calls per row and reports per-row failures", async ({ baseURL }) => {
  const email = `bulk-search-e2e-${Date.now()}@example.com`;
  const password = "RealPassword123!";

  const registerRes = await fetch(`${baseURL}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Bulk Search Test", email, password }),
  });
  const registerBody = await registerRes.json();
  createdUserId = registerBody.id ?? null;
  expect(createdUserId).toBeTruthy();

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  await page.goto("/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 8000 });

  await page.getByRole("button", { name: /bulk search from a csv/i }).click();
  await expect(page.getByRole("heading", { name: "Bulk search" })).toBeVisible();

  const csvContent = "query,location\ncoffee shops,Seattle WA\nbakeries,\"Austin, TX\"";
  await page.setInputFiles('input[type="file"]', {
    name: "leads.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csvContent),
  });

  // Real parsing happened client-side: both rows show up in the preview,
  // and the quoted "Austin, TX" location parsed as one field, not two.
  await expect(page.getByText("Ready to queue")).toBeVisible();
  await expect(page.getByText("coffee shops")).toBeVisible();
  await expect(page.getByText(/bakeries.*Austin, TX/)).toBeVisible();

  await page.getByRole("button", { name: /queue 2 searches/i }).click();

  // This fresh account has no search-provider key configured, a real,
  // common state for anyone who hasn't set up Locus yet. Every row should
  // genuinely fail with that real error, not silently succeed or hang, and
  // the modal should still reach a clean completed state.
  await expect(page.getByText(/queued 0 of 2 searches/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/2 rows failed to queue/i)).toBeVisible();
  // Both rows fail with the same real backend error (no search-provider key
  // configured), so this text is expected to appear twice, not once.
  await expect(page.getByText(/key in Settings/i).first()).toBeVisible();
  expect(await page.getByText(/key in Settings/i).count()).toBe(2);

  // This exact "done" state (with the per-row failure banner rendered) is
  // where the color-contrast violation was actually found, the plain-page
  // Dashboard scan never renders it. Real regression coverage rather than
  // trusting the fix by inspection alone.
  const results = await new AxeBuilder({ page }).analyze();
  const failing = results.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
  expect(failing).toEqual([]);

  await browser.close();
});
