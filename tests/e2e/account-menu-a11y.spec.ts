import { test, expect } from "@playwright/test";

// Regression: ISSUE-008. The account menu button's accessible name was just
// the user's initials (e.g. "QD"), with no hint it opens a menu or whether
// the menu is open.
// Found by /qa on 2026-11-27.
// Report: .gstack/qa-reports/qa-report-localhost-2026-11-27.md
test("account menu button has a real name and reports open/closed", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  const button = page.getByRole("button", { name: "Account menu" });
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("aria-expanded", "false");

  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: /Sign out/ })).toBeVisible();
});
