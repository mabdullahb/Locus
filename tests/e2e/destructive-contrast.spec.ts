import { test, expect, chromium } from "@playwright/test";
import { Client } from "pg";
import AxeBuilder from "@axe-core/playwright";

// Regression coverage for two real color-contrast bugs found this session.
// 1. The "bg-destructive/10 + text-destructive" tinted-banner pairing fails
//    WCAG's 4.5:1 minimum whenever the surrounding surface is bg-card,
//    bg-muted, or bg-popover (roughly 4.05-4.27:1 measured), even though
//    the identical pairing passes fine directly on bg-background (~4.71:1).
// 2. The solid "bg-destructive + text-destructive-foreground" button
//    pairing fails everywhere (3.31:1), the background itself is too
//    light for any light-colored text to reach 4.5:1 against it, fixed
//    with a separate, darker --destructive-solid token.
// Both only render on a genuine error or a confirm-delete flow, never on a
// plain page load, so neither was visible to a straightforward crawl.
// Every check below triggers the real condition, not a mocked approximation.
const FAILING_IMPACTS = ["critical", "serious"];

async function assertNoContrastViolation(page: import("@playwright/test").Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const failing = results.violations.filter((v) => FAILING_IMPACTS.includes(v.impact ?? "") && v.id === "color-contrast");
  if (failing.length > 0) {
    const summary = failing.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n");
    throw new Error(`Color-contrast violation in ${label}:\n${summary}`);
  }
}

test.describe("fresh throwaway accounts", () => {
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

  test("Settings > Account Details password-mismatch error has no contrast violation", async ({ baseURL }) => {
    const email = `contrast-account-${Date.now()}@example.com`;
    const password = "RealPassword123!";
    const registerRes = await fetch(`${baseURL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "contrast test", email, password }),
    });
    createdUserId = (await registerRes.json()).id ?? null;

    const browser = await chromium.launch();
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 8000 });

    await page.goto("/settings", { waitUntil: "networkidle" });
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill("CurrentPass123!");
    await passwordInputs.nth(1).fill("NewPassword123!");
    await passwordInputs.nth(2).fill("DifferentPassword456!");
    await page.getByRole("button", { name: /update password|change password/i }).click();
    await expect(page.getByText(/don't match/i)).toBeVisible();

    await assertNoContrastViolation(page, "Account Details password-mismatch banner");
    await browser.close();
  });

  test("Settings > Danger Zone delete-account error (banner + solid button) has no contrast violation", async ({ baseURL }) => {
    const email = `contrast-danger-${Date.now()}@example.com`;
    const password = "RealPassword123!";
    const registerRes = await fetch(`${baseURL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "contrast test", email, password }),
    });
    createdUserId = (await registerRes.json()).id ?? null;

    const browser = await chromium.launch();
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 8000 });

    await page.goto("/settings", { waitUntil: "networkidle" });
    // The solid "Permanently delete" (bg-destructive-solid) button is on
    // screen here too, this check covers both fixes at once: the double-
    // nested banner tint and the solid-button color pair.
    await page.getByRole("button", { name: "Delete my account" }).click();
    const emailConfirmInput = page.locator('input[type="text"], input[type="email"]').last();
    await emailConfirmInput.fill(email);
    const pwInput = page.locator('input[type="password"]').last();
    await pwInput.fill("WrongPassword999!");
    await page.getByRole("button", { name: /confirm|delete/i }).last().click();

    await expect(page.locator("text=/incorrect|wrong|failed/i").first()).toBeVisible({ timeout: 5000 });
    await assertNoContrastViolation(page, "Danger Zone delete-account error banner and solid button");
    await browser.close();
  });

  test("Session compare modal's error state has no contrast violation", async ({ baseURL }) => {
    const email = `contrast-compare-${Date.now()}@example.com`;
    const password = "RealPassword123!";
    const registerRes = await fetch(`${baseURL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "contrast test", email, password }),
    });
    createdUserId = (await registerRes.json()).id ?? null;

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const sessionAId = `${createdUserId}-a`;
    const sessionBId = `${createdUserId}-b`;
    try {
      for (const [id, query] of [[sessionAId, "coffee shops"], [sessionBId, "bakeries"]] as const) {
        await client.query(
          `INSERT INTO "ScrapeSession" (id, "userId", query, location, radius, concurrency, "proxyType", status, "totalYield", "startedAt", "completedAt", duration, config)
           VALUES ($1, $2, $3, 'Seattle, WA', '10', 8, 'residential', 'completed', 1, now(), now(), 60, '{}'::jsonb)`,
          [id, createdUserId, query],
        );
      }
    } finally {
      await client.end();
    }

    const browser = await chromium.launch();
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 8000 });

    // Force the modal's real error branch: intercept the compare call it
    // makes and answer with a failure, same as a real 404/500 would.
    await page.route("**/api/history/compare**", (route) =>
      route.fulfill({ status: 404, body: JSON.stringify({ error: "not found" }) }),
    );

    await page.goto("/history", { waitUntil: "networkidle" });
    const checkboxes = page.locator('tbody input[type="checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await page.getByRole("button", { name: "Compare" }).click();
    await expect(page.getByText("Failed to load comparison")).toBeVisible({ timeout: 5000 });

    await assertNoContrastViolation(page, "Session compare modal's error state");
    await browser.close();
  });
});

// Uses the shared e2e-suite-user (default authenticated storageState from
// playwright.config.ts), same identity accessibility.spec.ts's own passing
// "Lead detail modal" test already uses, it has real seeded leads to click
// "View" on. Read-only interaction, no state mutation, safe to share.
test("Lead detail modal's error state has no contrast violation", async ({ page }) => {
  // Intercepting the fetch forces the real error branch regardless of
  // which lead id actually gets requested.
  await page.route("**/api/leads/*", (route) =>
    route.fulfill({ status: 404, body: JSON.stringify({ error: "not found" }) }),
  );

  // A generic getByRole("button", { name: "View" }) can also match an
  // unrelated "View"-labeled element that exists in the DOM but is
  // currently off-screen (the collapsed History side panel, translated out
  // via CSS, not unmounted). Scoping to the real leads table removes that
  // ambiguity. The taller viewport keeps the actual row comfortably clear
  // of the default 720px-tall viewport's bottom edge, where it otherwise
  // sits right at the boundary.
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await page.locator("table").getByRole("button", { name: "View" }).first().click();
  await expect(page.getByText("Failed to load lead details")).toBeVisible({ timeout: 5000 });

  await assertNoContrastViolation(page, "Lead detail modal's error state");
});
