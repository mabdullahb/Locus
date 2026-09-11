import { describe, it, expect } from "vitest";
import { buildRerunUrl, parseRerunParams } from "@/lib/rerun-params";

describe("rerun-params", () => {
  // Regression: radius and locale were dropped entirely from the round trip,
  // so "Re-run" from History silently used whatever the dashboard form's
  // leftover default happened to be (10km) instead of the original run's
  // actual radius (e.g. 1km), with no indication anything had changed.
  it("carries radius and locale through the round trip", () => {
    const url = buildRerunUrl({
      keyword: "pharmacy",
      location: "shah ali banda",
      enrichmentDepth: "standard",
      radius: "1",
      locale: "en-IN",
    });

    const searchParams = new URL(url, "http://localhost").searchParams;
    const parsed = parseRerunParams(searchParams);

    expect(parsed).toEqual({
      keyword: "pharmacy",
      location: "shah ali banda",
      enrichmentDepth: "standard",
      radius: "1",
      locale: "en-IN",
    });
  });

  it("returns null when required params are missing", () => {
    const searchParams = new URLSearchParams({ rerunDepth: "standard" });
    expect(parseRerunParams(searchParams)).toBeNull();
  });

  it("falls back to sensible defaults for radius and locale if absent", () => {
    const searchParams = new URLSearchParams({
      rerunKeyword: "salon",
      rerunLocation: "malakpet",
    });
    expect(parseRerunParams(searchParams)).toEqual({
      keyword: "salon",
      location: "malakpet",
      enrichmentDepth: "standard",
      radius: "10",
      locale: "en-US",
    });
  });
});
