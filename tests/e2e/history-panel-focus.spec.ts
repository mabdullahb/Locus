import { test, expect } from "@playwright/test";

// Regression: ISSUE-001. The closed History panel only slid off-screen, so
// keyboard focus walked into its invisible buttons (25 Tab presses from the
// top of Analytics landed on "View details" inside it) and screen readers
// read a panel nobody could see.
// Found by /qa on 2026-11-27.
// Report: .gstack/qa-reports/qa-report-localhost-2026-11-27.md
const PANEL = "div.fixed.right-0.z-40";

test("Tab never reaches the closed History panel", async ({ page }) => {
  await page.goto("/analytics");
  await page.waitForLoadState("networkidle");

  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const insideClosedPanel = await page.evaluate(
      (sel) => !!document.activeElement?.closest(sel),
      PANEL,
    );
    expect(insideClosedPanel, `Tab press ${i + 1} focused an element in the closed panel`).toBe(false);
  }
});

test("the History panel's controls are reachable once it's open", async ({ page }) => {
  await page.goto("/analytics");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^History/ }).click();

  const close = page.getByRole("button", { name: "Close history panel" });
  await expect(close).toBeVisible();
  await close.focus();
  await expect(close).toBeFocused();

  await close.click();
  await expect(page.locator(PANEL)).toHaveAttribute("inert", "");
});
