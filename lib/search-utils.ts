// Pure, side-effect-free search-result helpers shared with server/index.ts.
// Kept out of server/index.ts (which starts a live Express/BullMQ/Redis
// server as soon as it's imported) so they can be unit tested directly.

export interface SearchResultItem {
  title: string;
  address: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews: number | null;
  lat: number | null;
  lng: number | null;
  // A stable provider-native identifier for this business, when the
  // provider's response includes one. Google Places always does (place_id).
  // SerpApi's Google Maps engine usually does. Serper.dev's /places
  // endpoint may or may not, unconfirmed against a live key as of this
  // writing. Left null there rather than guessed, since a wrong guess would
  // be worse than no id: it would wrongly merge two different businesses
  // instead of just falling back to name+location matching.
  placeId: string | null;
}

// Normalizes a business name or address for the name+location dedup
// fallback: lowercased, whitespace-collapsed, trimmed. Not meant to be
// perfect (won't catch "St" vs "Street"), just meaningfully better than the
// exact-string match it replaces.
export function normalizeForDedupe(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

// The key used to recognize "this is the same business" across sessions.
// Prefers a real provider place id (exact, reliable) over the normalized
// name+location fallback (approximate, catches most re-finds but not all).
export function computeDedupeKey(item: Pick<SearchResultItem, "placeId" | "title" | "address">): string {
  if (item.placeId) return `place:${item.placeId}`;
  return `norm:${normalizeForDedupe(item.title)}|${normalizeForDedupe(item.address)}`;
}

// The Advanced Settings locale field is fixed to English (US), the other
// options (English India, Hindi India, English UK) were removed from the
// picker. This still parses it into the language/country codes each
// provider's API actually accepts, and still accepts other values for any
// stored config or rerun link created before that change.
export function parseLocale(locale: string | undefined): { hl: string; gl: string } {
  const [hl, gl] = (locale || "en-US").split("-");
  return { hl: (hl || "en").toLowerCase(), gl: (gl || "US").toLowerCase() };
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// The radius dropdown ("1 km", "5 km", ...) used to be pure decoration —
// every provider only ever got a free-text "{query} {location}" search with
// no geographic constraint, so a 1km search could return results from
// anywhere. There's no separate geocoding call for the searched location
// (which would need its own API key/dependency); instead the center point is
// the centroid of whichever results in this batch have coordinates, and
// anything farther than the chosen radius from that centroid is dropped.
// Results with no coordinates (a provider field missing/changed) are kept
// rather than silently dropped, since we have no way to judge their distance.
export function filterByRadius(results: SearchResultItem[], radiusKm: string): SearchResultItem[] {
  if (radiusKm === "unlimited") return results;
  const radius = parseFloat(radiusKm);
  if (!Number.isFinite(radius) || radius <= 0) return results;

  const withCoords = results.filter(
    (r): r is SearchResultItem & { lat: number; lng: number } => r.lat != null && r.lng != null,
  );
  if (withCoords.length === 0) return results;

  const centerLat = withCoords.reduce((sum, r) => sum + r.lat, 0) / withCoords.length;
  const centerLng = withCoords.reduce((sum, r) => sum + r.lng, 0) / withCoords.length;

  return results.filter((r) => {
    if (r.lat == null || r.lng == null) return true;
    return haversineKm(centerLat, centerLng, r.lat, r.lng) <= radius;
  });
}
