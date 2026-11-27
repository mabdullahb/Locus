import { parseLocale, type SearchResultItem } from "@/lib/search-utils";

type SerperMapsResponse = {
  // "@lat,lng,zoom" for the area Serper resolved the query to. Required on
  // every request after page 1, see below.
  ll?: string;
  places?: Array<{ title?: string; address?: string; phoneNumber?: string; website?: string; rating?: number; ratingCount?: number; latitude?: number; longitude?: number; cid?: string }>;
};

const FETCH_TIMEOUT = 30000;

async function requestMapsPage(
  serperKey: string, q: string, page: number, gl: string, hl: string, ll: string | null,
): Promise<SerperMapsResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    // /maps, not /places: by November 2026 Serper's /places response had
    // dropped phoneNumber entirely (checked live: no phone field on any
    // result), so every Serper extraction saved leads with no phone. /maps
    // returns the same fields Locus reads here, phoneNumber and cid included.
    // It rejects page > 1 without "ll" (HTTP 400, "Parameter ll (GPS
    // location) is required for paginated maps search"), so later pages
    // reuse the ll that page 1 resolved to.
    const res = await fetch("https://google.serper.dev/maps", {
      method: "POST",
      signal: controller.signal,
      headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q, page, gl, hl, ...(page > 1 && ll ? { ll } : {}) }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Serper.dev HTTP ${res.status}: ${body.slice(0, 500)}`);
    }
    return await res.json();
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("Serper.dev request timed out");
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Serper.dev Google Maps search. Lives outside server/index.ts so it can be
// unit tested without starting the worker.
export async function fetchSerperResults(
  serperKey: string, query: string, location: string, targetCount: number, startPage: number,
  locale?: string, startLl?: string | null,
): Promise<{ results: SearchResultItem[]; nextPage: number; hasMore: boolean; ll: string | null }> {
  if (!serperKey) throw new Error("Serper.dev key is empty");

  const { hl, gl } = parseLocale(locale);
  const q = `${query} ${location}`;
  const results: SearchResultItem[] = [];
  let page = startPage;
  let hasMore = false;
  let ll = startLl ?? null;

  // A "Load more" continuation saved before the /maps switch has a page
  // number but no ll. Page 1 is the only way to learn ll, so fetch it once.
  // Its page number also counted /places pages of 10 results, and /maps
  // pages hold 20, so old page N (results from (N-1)*10+1) maps to /maps
  // page floor((N-1)/2)+1. Without that, an old "page 11" skipped results
  // 101-200. Any overlap is handled by the session's dedupe.
  if (page > 1 && !ll) {
    ll = (await requestMapsPage(serperKey, q, 1, gl, hl, null)).ll ?? null;
    page = Math.floor((page - 1) / 2) + 1;
  }

  while (results.length < targetCount) {
    const data = await requestMapsPage(serperKey, q, page, gl, hl, ll);
    ll = ll ?? data.ll ?? null;

    const items = data.places || [];
    page += 1;
    if (items.length === 0) {
      hasMore = false;
      break;
    }

    for (const item of items) {
      results.push({
        title: item.title || "",
        address: item.address || "",
        phone: item.phoneNumber || null,
        placeId: item.cid || null,
        website: item.website || null,
        rating: item.rating || null,
        reviews: item.ratingCount || null,
        lat: typeof item.latitude === "number" ? item.latitude : null,
        lng: typeof item.longitude === "number" ? item.longitude : null,
      });
      if (results.length >= targetCount) break;
    }

    // Serper doesn't return an explicit "more pages" flag. A full page
    // (10 or more results) suggests there may be another, a short page
    // means we've hit the end of what the provider has for this query.
    hasMore = items.length >= 10;
    if (!hasMore || results.length >= targetCount) break;
  }

  return { results, nextPage: page, hasMore, ll };
}
