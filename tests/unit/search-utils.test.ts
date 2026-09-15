import { describe, it, expect } from "vitest";
import {
  parseLocale,
  haversineKm,
  filterByRadius,
  normalizeForDedupe,
  computeDedupeKey,
  type SearchResultItem,
} from "@/lib/search-utils";

function result(overrides: Partial<SearchResultItem>): SearchResultItem {
  return {
    title: overrides.title ?? "Business",
    address: overrides.address ?? "",
    phone: overrides.phone ?? null,
    website: overrides.website ?? null,
    rating: overrides.rating ?? null,
    reviews: overrides.reviews ?? null,
    lat: overrides.lat ?? null,
    lng: overrides.lng ?? null,
    placeId: overrides.placeId ?? null,
  };
}

describe("parseLocale", () => {
  // Regression: the Advanced Settings "Locale" dropdown used to be collected
  // in the form and never sent to any provider — every search ran in
  // English/India regardless of what was selected.
  it("parses a locale string into language/country codes", () => {
    expect(parseLocale("en-US")).toEqual({ hl: "en", gl: "us" });
    expect(parseLocale("hi-IN")).toEqual({ hl: "hi", gl: "in" });
  });

  it("defaults to en-US when no locale is given", () => {
    expect(parseLocale(undefined)).toEqual({ hl: "en", gl: "us" });
  });
});

describe("haversineKm", () => {
  it("returns ~0 for the same point", () => {
    expect(haversineKm(17.35, 78.47, 17.35, 78.47)).toBeCloseTo(0, 5);
  });

  it("returns a sensible distance for two known points", () => {
    // Hyderabad to Bangalore, roughly 500km apart.
    const km = haversineKm(17.385, 78.4867, 12.9716, 77.5946);
    expect(km).toBeGreaterThan(450);
    expect(km).toBeLessThan(600);
  });
});

describe("filterByRadius", () => {
  // Regression: the radius dropdown ("1 km", "5 km", ...) used to be pure
  // decoration — no provider ever received it, so a "1 km" search could
  // return results from anywhere.
  it("drops results farther than the radius from the centroid", () => {
    // A single distant outlier drags the centroid toward itself — with only
    // a couple of points that skew is large enough to pull even the "near"
    // points outside a tight radius. Using 9 clustered near points (matching
    // a realistic batch size) keeps the centroid anchored close to the real
    // cluster; exact distances here (near ~18km, far ~165km from centroid)
    // were verified with the actual haversineKm function before writing
    // this assertion, not estimated by hand.
    const near = Array.from({ length: 9 }, (_, i) =>
      result({ title: `Near ${i}`, lat: 17.35 + i * 0.0002, lng: 78.47 + i * 0.0002 }),
    );
    const far = result({ title: "Far away", lat: 19.0, lng: 78.47 });

    const filtered = filterByRadius([...near, far], "25");

    expect(filtered.map((r) => r.title)).toEqual(near.map((r) => r.title));
  });

  it("returns everything unchanged for 'unlimited'", () => {
    const results = [
      result({ title: "A", lat: 17.35, lng: 78.47 }),
      result({ title: "B", lat: 12.9716, lng: 77.5946 }),
    ];
    expect(filterByRadius(results, "unlimited")).toEqual(results);
  });

  it("keeps results with no coordinates rather than dropping them blind", () => {
    const results = [
      result({ title: "Has coords", lat: 17.35, lng: 78.47 }),
      result({ title: "No coords", lat: null, lng: null }),
    ];
    const filtered = filterByRadius(results, "1");
    expect(filtered.map((r) => r.title)).toEqual(["Has coords", "No coords"]);
  });

  it("does not filter when none of the results have coordinates", () => {
    const results = [
      result({ title: "A", lat: null, lng: null }),
      result({ title: "B", lat: null, lng: null }),
    ];
    expect(filterByRadius(results, "1")).toEqual(results);
  });
});

describe("normalizeForDedupe", () => {
  it("lowercases, trims, and collapses internal whitespace", () => {
    expect(normalizeForDedupe("  Joe's   Coffee Shop  ")).toBe("joe's coffee shop");
  });

  it("treats tabs and newlines the same as spaces", () => {
    expect(normalizeForDedupe("Joe's\tCoffee\nShop")).toBe("joe's coffee shop");
  });
});

describe("computeDedupeKey", () => {
  it("prefers a provider place id when present, over name and address", () => {
    const key = computeDedupeKey({ placeId: "ChIJ123", title: "Joe's Coffee", address: "1 Main St" });
    expect(key).toBe("place:ChIJ123");
  });

  it("falls back to normalized name+address when no place id is given", () => {
    const key = computeDedupeKey({ placeId: null, title: "Joe's Coffee", address: "1 Main St" });
    expect(key).toBe("norm:joe's coffee|1 main st");
  });

  // This is the actual bug the exact-string match had: two results for the
  // same business, differently formatted by two different providers (or
  // the same provider on two different days), used to be treated as two
  // separate businesses instead of one re-find.
  it("matches the same business found by two different providers with slightly different formatting", () => {
    const fromSerpApi = computeDedupeKey({ placeId: null, title: "Joe's Coffee", address: "1 Main St, Seattle, WA" });
    const fromSerper = computeDedupeKey({ placeId: null, title: "  joe's coffee  ", address: "1  main   st, seattle, wa" });
    expect(fromSerpApi).toBe(fromSerper);
  });

  it("does not match two different businesses with a place id from one and none from the other", () => {
    const withPlaceId = computeDedupeKey({ placeId: "ChIJ456", title: "Same Name Cafe", address: "2 Oak St" });
    const withoutPlaceId = computeDedupeKey({ placeId: null, title: "Same Name Cafe", address: "2 Oak St" });
    // A real place id and a normalized-name fallback are namespaced
    // ("place:" vs "norm:") specifically so they never collide, even when
    // the underlying business happens to be the same one. A provider that
    // sometimes returns an id and sometimes doesn't shouldn't cause a
    // false re-find against its own earlier, id-less result.
    expect(withPlaceId).not.toBe(withoutPlaceId);
  });
});
