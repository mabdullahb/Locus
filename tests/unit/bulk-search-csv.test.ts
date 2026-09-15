import { describe, it, expect } from "vitest";
import { parseBulkSearchCsv, MAX_BULK_SEARCH_ROWS } from "@/lib/bulk-search-csv";

describe("parseBulkSearchCsv", () => {
  it("parses a simple file with a header row", () => {
    const csv = "query,location\ncoffee shops,Seattle WA\nbakeries,Portland OR";
    const result = parseBulkSearchCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { query: "coffee shops", location: "Seattle WA", radius: undefined },
      { query: "bakeries", location: "Portland OR", radius: undefined },
    ]);
  });

  it("parses a file with no header, straight into data", () => {
    const csv = "coffee shops,Seattle WA\nbakeries,Portland OR";
    const result = parseBulkSearchCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].query).toBe("coffee shops");
  });

  it("correctly parses a quoted location containing a comma", () => {
    const csv = 'query,location\ncoffee shops,"Austin, TX"';
    const result = parseBulkSearchCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([{ query: "coffee shops", location: "Austin, TX", radius: undefined }]);
  });

  it("reads an optional third radius column", () => {
    const csv = "query,location,radius\ncoffee shops,Seattle WA,10";
    const result = parseBulkSearchCsv(csv);
    expect(result.rows).toEqual([{ query: "coffee shops", location: "Seattle WA", radius: "10" }]);
  });

  it("skips a fully blank row silently, without an error", () => {
    const csv = "query,location\ncoffee shops,Seattle WA\n,\nbakeries,Portland OR";
    const result = parseBulkSearchCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
  });

  it("reports a row-level error and excludes the row when only one of query/location is present", () => {
    const csv = "query,location\ncoffee shops,\n,Seattle WA";
    const result = parseBulkSearchCsv(csv);
    expect(result.rows).toEqual([]);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain("Row 2");
    expect(result.errors[1]).toContain("Row 3");
  });

  it("reports an error for a genuinely empty file", () => {
    const result = parseBulkSearchCsv("");
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(["The file is empty."]);
  });

  it("caps rows at MAX_BULK_SEARCH_ROWS and reports how many were dropped", () => {
    const lines = ["query,location"];
    for (let i = 0; i < MAX_BULK_SEARCH_ROWS + 10; i++) {
      lines.push(`query ${i},Location ${i}`);
    }
    const result = parseBulkSearchCsv(lines.join("\n"));
    expect(result.rows).toHaveLength(MAX_BULK_SEARCH_ROWS);
    expect(result.errors.some((e) => e.includes(String(MAX_BULK_SEARCH_ROWS)))).toBe(true);
  });
});
