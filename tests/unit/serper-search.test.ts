import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchSerperResults } from "@/lib/search/serper";

// Regression: ISSUE-004. Serper's /places response dropped phoneNumber
// (checked live on 2026-11-27: no phone field on any result), so every
// Serper extraction saved leads with no phone. September runs had phones
// for 143 of 266 leads, the first November run had 0 of 25. /maps still
// returns phoneNumber with the same field names.
// Found by /qa on 2026-11-27.
// Report: .gstack/qa-reports/qa-report-localhost-2026-11-27.md
function place(i: number, extra: Record<string, unknown> = {}) {
  return { title: `Bakery ${i}`, address: `${i} Main St`, latitude: 30.27, longitude: -98.87, website: `https://b${i}.example`, cid: `${i}`, ...extra };
}

function okJson(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as Response);
}

describe("fetchSerperResults", () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("calls the /maps endpoint, not /places", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(okJson({ places: [place(1, { phoneNumber: "(830) 555-0101" })] }));
    await fetchSerperResults("key", "bakery", "Fredericksburg, TX", 5, 1);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("https://google.serper.dev/maps");
  });

  it("maps phoneNumber, website, coordinates and cid onto each result", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      okJson({ places: [place(1, { phoneNumber: "(830) 555-0101", rating: 4.6, ratingCount: 120 }), place(2)] }),
    );
    const { results } = await fetchSerperResults("key", "bakery", "Fredericksburg, TX", 5, 1);
    expect(results[0]).toMatchObject({ title: "Bakery 1", phone: "(830) 555-0101", website: "https://b1.example", placeId: "1", lat: 30.27, lng: -98.87, rating: 4.6, reviews: 120 });
    expect(results[1].phone).toBeNull();
  });

  it("sends the query, page and locale in the request body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(okJson({ places: [place(1)] }));
    await fetchSerperResults("key", "bakery", "Fredericksburg, TX", 5, 1, "de-DE");
    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toMatchObject({ q: "bakery Fredericksburg, TX", page: 1, gl: "de", hl: "de" });
    expect((init.headers as Record<string, string>)["X-API-KEY"]).toBe("key");
  });

  it("pages until the target count and reports more when a page is full", async () => {
    const page = (n: number) => okJson({ places: Array.from({ length: 20 }, (_, i) => place(n * 100 + i)) });
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(page(1)).mockReturnValueOnce(page(2));
    const { results, nextPage, hasMore } = await fetchSerperResults("key", "bakery", "Austin", 30, 1);
    expect(results).toHaveLength(30);
    expect(nextPage).toBe(3);
    expect(hasMore).toBe(true);
  });

  // Live /maps rejects page > 1 without ll: HTTP 400 "Parameter ll (GPS
  // location) is required for paginated maps search (page > 1)". The first
  // live run after switching endpoints failed exactly this way.
  it("sends page 1's ll on every later page and returns it for the continuation", async () => {
    const page = (n: number) => okJson({ ll: "@30.05,-99.14,14z", places: Array.from({ length: 20 }, (_, i) => place(n * 100 + i)) });
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockReturnValueOnce(page(1)).mockReturnValueOnce(page(2));
    const { ll } = await fetchSerperResults("key", "pharmacy", "Kerrville, TX", 30, 1);
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string));
    expect(bodies[0].ll).toBeUndefined();
    expect(bodies[1]).toMatchObject({ page: 2, ll: "@30.05,-99.14,14z" });
    expect(ll).toBe("@30.05,-99.14,14z");
  });

  it("resumes a Load more continuation with its saved ll", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockReturnValueOnce(okJson({ places: [place(1)] }));
    await fetchSerperResults("key", "pharmacy", "Kerrville, TX", 30, 3, undefined, "@30.05,-99.14,14z");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({ page: 3, ll: "@30.05,-99.14,14z" });
  });

  it("looks up ll from page 1 when an older continuation has none", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockReturnValueOnce(okJson({ ll: "@30.05,-99.14,14z", places: [place(1)] }))
      .mockReturnValueOnce(okJson({ places: [place(2)] }));
    const { results } = await fetchSerperResults("key", "pharmacy", "Kerrville, TX", 30, 3);
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string));
    expect(bodies[0].page).toBe(1);
    // Old /places page 3 (results 21-30) is /maps page 2 (results 21-40).
    expect(bodies[1]).toMatchObject({ page: 2, ll: "@30.05,-99.14,14z" });
    expect(results.map((r) => r.title)).toEqual(["Bakery 2"]);
  });

  // Found live: an old Portland continuation at /places page 11 (result 101
  // onward) was fetched as /maps page 11 (results 201-220), skipping 100.
  it.each([
    [2, 1],
    [3, 2],
    [11, 6],
    [12, 6],
  ])("converts old /places page %i to /maps page %i", async (oldPage, mapsPage) => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockReturnValueOnce(okJson({ ll: "@45.5,-122.6,13z", places: [place(1)] }))
      .mockReturnValueOnce(okJson({ places: [] }));
    await fetchSerperResults("key", "bakeries", "Portland OR", 100, oldPage);
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string).page).toBe(mapsPage);
  });

  it("does not convert a page that already has its ll (saved after the switch)", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockReturnValueOnce(okJson({ places: [] }));
    await fetchSerperResults("key", "bakeries", "Portland OR", 100, 11, undefined, "@45.5,-122.6,13z");
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).page).toBe(11);
  });

  it("stops and reports no more results on an empty page", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(okJson({ places: [place(1), place(2)] }));
    const { results, hasMore } = await fetchSerperResults("key", "bakery", "Austin", 30, 1);
    expect(results).toHaveLength(2);
    expect(hasMore).toBe(false);
  });

  it("surfaces Serper's own error body on a non-ok response", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 400, text: async () => '{"message":"Not enough credits"}' });
    await expect(fetchSerperResults("key", "bakery", "Austin", 5, 1)).rejects.toThrow(/Serper.dev HTTP 400: .*Not enough credits/);
  });

  it("rejects an empty key before calling Serper", async () => {
    await expect(fetchSerperResults("", "bakery", "Austin", 5, 1)).rejects.toThrow("Serper.dev key is empty");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
