import { describe, it, expect } from "vitest";
import { canDowngradeEnrichmentStatus } from "@/lib/enrichment";

// Regression: a later enrichment attempt (a retry, a rate-limited re-run, a
// concurrent duplicate call) that found nothing or errored used to
// unconditionally overwrite a lead's status — silently downgrading a lead
// that already had a real, previously-confirmed email back to
// "needs_enrich"/"failed" while leaving the real email sitting untouched in
// the database.
describe("canDowngradeEnrichmentStatus", () => {
  it("allows downgrading a lead that was never verified", () => {
    expect(canDowngradeEnrichmentStatus(false)).toBe(true);
  });

  it("refuses to downgrade a lead that already has a confirmed email", () => {
    expect(canDowngradeEnrichmentStatus(true)).toBe(false);
  });
});
