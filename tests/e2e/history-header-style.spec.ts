import { test, expect } from "@playwright/test";

// The sortable History headers (Query, Location, Date, Status, Leads) use
// SortHeader's small muted style. Emails, Enriched and Duration aren't
// sortable and were bare spans, so they fell back to the browser's default
// table header style (bold, full brightness). The header screenshot test's
// 2% tolerance didn't catch it.
test("every History column header uses the same text style", async ({ page }) => {
  await page.goto("/history");
  await page.waitForLoadState("networkidle");

  const styles = await page.locator("thead [data-testid=sort-label]").evaluateAll((labels) =>
    labels.map((l) => {
      const cs = getComputedStyle(l);
      return { label: l.textContent?.trim(), style: `${cs.fontWeight} ${cs.fontSize} ${cs.color}` };
    }),
  );

  expect(styles.map((s) => s.label)).toEqual(expect.arrayContaining(["Leads", "Emails", "Enriched", "Duration"]));
  const distinct = new Set(styles.map((s) => s.style));
  expect(distinct.size, JSON.stringify(styles)).toBe(1);
});
