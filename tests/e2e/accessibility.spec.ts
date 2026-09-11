import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Automated WCAG checks for the app's core authenticated pages. Fails on any
// "critical" or "serious" violation so accessibility regressions surface in
// CI instead of requiring a manual audit. "moderate"/"minor" issues are
// reported but don't fail the build yet — a starting bar, not a ceiling.
const FAILING_IMPACTS = ["critical", "serious"];

const pages = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "History", path: "/history" },
  { name: "AI Enrichment", path: "/enrichment" },
  { name: "API Keys", path: "/api-keys" },
];

for (const { name, path } of pages) {
  test(`${name} has no critical/serious accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).analyze();
    const failing = results.violations.filter((v) => FAILING_IMPACTS.includes(v.impact ?? ""));

    if (failing.length > 0) {
      const summary = failing
        .map((v) => `${v.impact}: ${v.id} — ${v.help} (${v.nodes.length} element(s))`)
        .join("\n");
      throw new Error(`Accessibility violations on ${name}:\n${summary}`);
    }

    expect(failing).toEqual([]);
  });
}

// The default API Keys page load never exercises the OpenRouter/9Router
// conditional fields (they only render once that provider is selected in
// the dropdown), so the loop above never actually scans them, exactly the
// class of bug a straightforward crawl misses. Regression test for a real
// violation found this way: both fields' <select>/<input> had a <label>
// with no htmlFor/id pairing, so their accessible name was blank.
test("API Keys page has no violations in its conditional OpenRouter/9Router fields", async ({ page }) => {
  await page.goto("/api-keys");
  await page.waitForLoadState("networkidle");

  for (const provider of ["openrouter", "9router"]) {
    await page.locator("#provider-select").selectOption(provider);
    const results = await new AxeBuilder({ page }).analyze();
    const failing = results.violations.filter((v) => FAILING_IMPACTS.includes(v.impact ?? ""));
    if (failing.length > 0) {
      const summary = failing.map((v) => `${v.impact}: ${v.id} — ${v.help} (${v.nodes.length} element(s))`).join("\n");
      throw new Error(`Accessibility violations with provider=${provider} selected:\n${summary}`);
    }
  }
});

// Same reasoning as above: a modal opened via a button click is invisible
// to a plain page-load scan, so it needs its own check. Finding this one
// (a close button with no accessible name) turned up the same bug, copied
// via the same close-button pattern, in two more modals: components/table/
// lead-detail-modal.tsx and components/history/session-compare-modal.tsx,
// both fixed and both covered below too, not just the one that happened to
// get checked first.
async function assertNoA11yViolations(page: import("@playwright/test").Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const failing = results.violations.filter((v) => FAILING_IMPACTS.includes(v.impact ?? ""));
  if (failing.length > 0) {
    const summary = failing.map((v) => `${v.impact}: ${v.id} — ${v.help} (${v.nodes.length} element(s))`).join("\n");
    throw new Error(`Accessibility violations in ${label}:\n${summary}`);
  }
}

test("Bulk search modal has no critical/serious accessibility violations while open", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /bulk search from a csv/i }).click();
  await expect(page.getByRole("heading", { name: "Bulk search" })).toBeVisible();
  await assertNoA11yViolations(page, "the open Bulk search modal");
});

test("Lead detail modal has no critical/serious accessibility violations while open", async ({ page }) => {
  // A generic getByRole("button", { name: "View" }) can also match an
  // unrelated "View"-labeled element that exists in the DOM but is
  // currently off-screen (the collapsed History side panel, translated out
  // via CSS, not unmounted). Scoping to the real leads table removes that
  // ambiguity. The taller viewport keeps the actual row comfortably clear
  // of the default 720px-tall viewport's bottom edge, where it otherwise
  // sits right at the boundary.
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.locator("table").getByRole("button", { name: "View" }).first().click();
  await expect(page.getByRole("heading", { name: "Lead Details" })).toBeVisible();
  await assertNoA11yViolations(page, "the open Lead Details modal");
});
