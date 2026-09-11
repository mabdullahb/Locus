import { test, expect, type Page, type Locator } from "@playwright/test";

// Regression coverage for the History/Dashboard alignment bugs from this
// session: a sortable header rendered as a block-level flex button, so the
// parent cell's text-align had no effect on it — header text sat left while
// its column of data sat right/center. Checking a container element's own
// bounding box (<th> or the header <button>) does NOT catch this: both are
// full-width regardless of where their text sits inside them. These assert
// on the actual rendered text position (via Range.getBoundingClientRect,
// the same technique used to manually verify the original fix), which is
// the only thing that was actually wrong. Verified this test file fails
// against a deliberately-reintroduced version of the original bug before
// relying on it.

async function textCenterX(locator: Locator): Promise<number> {
  return locator.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rect = range.getBoundingClientRect();
    return rect.left + rect.width / 2;
  });
}

async function assertHeaderMatchesFirstDataCell(page: Page, label: string) {
  const header = page.locator(`thead th:has-text("${label}")`).first();
  const headerBox = await header.boundingBox();

  // Sortable headers wrap their label in a span with a stable test id (the
  // label itself is a flex child inside a full-width block-level <button>,
  // so measuring the <th> or the button directly always returns the full
  // column width regardless of where the text visually sits — the exact
  // shape of the original bug). Plain, non-sortable headers have no such
  // wrapper and are genuine inline text, so the <th> itself is measurable.
  const labelSpan = header.locator('[data-testid="sort-label"]');
  const headerTarget = (await labelSpan.count()) > 0 ? labelSpan : header;
  const headerCenter = await textCenterX(headerTarget);
  if (!headerBox) throw new Error(`Header cell not found: ${label}`);

  // Find the data cell in the same column by matching the header cell's x
  // position/width (column index can shift, this doesn't).
  const firstRowCells = page.locator("tbody tr").first().locator("td");
  const cellCount = await firstRowCells.count();
  let matchedCell: Locator | null = null;
  for (let i = 0; i < cellCount; i++) {
    const cell = firstRowCells.nth(i);
    const cellBox = await cell.boundingBox();
    if (
      cellBox &&
      Math.abs(cellBox.x - headerBox.x) < 2 &&
      Math.abs(cellBox.width - headerBox.width) < 2
    ) {
      matchedCell = cell;
      break;
    }
  }
  expect(matchedCell, `no data cell found under "${label}" header`).not.toBeNull();

  const cellCenter = await textCenterX(matchedCell as Locator);
  expect(
    Math.abs(headerCenter - cellCenter),
    `"${label}" header text center (${headerCenter}) vs data cell text center (${cellCenter})`,
  ).toBeLessThan(3);
}

test.describe("History table column alignment", () => {
  test("Status/Leads/Emails/Enriched/Duration headers align with their data", async ({ page }) => {
    await page.goto("/history");
    await page.waitForLoadState("networkidle");

    for (const label of ["Status", "Leads", "Emails", "Enriched", "Duration"]) {
      await assertHeaderMatchesFirstDataCell(page, label);
    }
  });

  test("header row screenshot (catches wrapping regressions)", async ({ page }) => {
    await page.goto("/history");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("thead").first()).toHaveScreenshot("history-header.png", {
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe("Dashboard leads table column alignment", () => {
  test("Status/Actions headers align with their data (centered)", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    for (const label of ["Status", "Actions"]) {
      await assertHeaderMatchesFirstDataCell(page, label);
    }
  });

  test("header row screenshot (catches wrapping regressions)", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("table thead").first()).toHaveScreenshot("dashboard-header.png", {
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe("Admin users table column alignment", () => {
  test("Extractions header aligns with its data (centered)", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await assertHeaderMatchesFirstDataCell(page, "Extractions");
  });
});

test.describe("Column resize", () => {
  // Regression: shrinking a resizable column used to let its text overflow
  // visually into the next column (long emails overlapping the Status
  // badge) instead of being clipped to the column's own width.
  test("Dashboard: shrinking Email column truncates instead of overlapping the next column", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Sort by Email Address first — blank emails always sort last (a prior
    // fix), so this guarantees row 1 has actual (often long) email text to
    // potentially overflow. Without this, row 1 can happen to have a blank
    // email and the assertion below would trivially "pass" either way.
    await page.locator('th:has-text("Email Address")').click();

    const emailHeader = page.locator('th:has-text("Email Address")');
    const handle = emailHeader.locator('[aria-label="Resize column"]');
    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error("resize handle not found");

    await page.mouse.move(handleBox.x + 1, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x - 130, handleBox.y + handleBox.height / 2, { steps: 10 });
    await page.mouse.up();

    const emailCell = page.locator("tbody tr").first().locator("td").nth(4);
    const emailCellBox = await emailCell.boundingBox();
    const emailTextBox = await emailCell.locator("span").boundingBox();
    if (!emailCellBox || !emailTextBox) throw new Error("email cell/text not found");
    expect((await emailCell.textContent())?.trim()).not.toBe("");

    expect(emailTextBox.x + emailTextBox.width).toBeLessThanOrEqual(
      emailCellBox.x + emailCellBox.width + 1,
    );
  });

  test("resize divider is visible without hovering", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const divider = page.locator('th:has-text("Location") [aria-label="Resize column"] > span');
    await expect(divider).toBeVisible();
    const bg = await divider.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  });
});
