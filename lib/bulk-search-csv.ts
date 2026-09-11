// Parses a small CSV of query/location pairs for the Dashboard's bulk
// search upload. Reuses xlsx (already a dependency for export) rather than
// hand-rolling CSV parsing, real locations routinely contain commas
// ("Austin, TX"), which needs correct quoted-field handling to parse
// safely, exactly the kind of edge case a naive split(",") gets wrong.
import * as XLSX from "xlsx";

export interface BulkSearchRow {
  query: string;
  location: string;
  radius?: string;
}

export interface ParseBulkSearchCsvResult {
  rows: BulkSearchRow[];
  errors: string[];
}

// Caps how many searches one upload can queue, protecting both the user's
// own provider costs and the worker's queue from an accidentally huge file.
// Someone with a genuinely larger list splits it into multiple uploads.
export const MAX_BULK_SEARCH_ROWS = 50;

export function parseBulkSearchCsv(csvText: string): ParseBulkSearchCsvResult {
  const trimmedInput = csvText.trim();
  if (!trimmedInput) {
    return { rows: [], errors: ["The file is empty."] };
  }

  const workbook = XLSX.read(csvText, { type: "string" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });

  if (raw.length === 0) {
    return { rows: [], errors: ["The file is empty."] };
  }

  // A header row ("query,location") and a file with no header at all (just
  // straight into data) are both reasonable things for someone exporting
  // from a spreadsheet to produce, so detect rather than require one.
  const first = raw[0].map((c) => String(c ?? "").trim().toLowerCase());
  const hasHeader = first[0] === "query" || first[0] === "keyword";
  const dataRows = hasHeader ? raw.slice(1) : raw;

  const rows: BulkSearchRow[] = [];
  const errors: string[] = [];

  dataRows.forEach((cells, i) => {
    const rowNum = i + (hasHeader ? 2 : 1); // 1-indexed, accounts for the header line
    const query = String(cells[0] ?? "").trim();
    const location = String(cells[1] ?? "").trim();
    const radiusCell = cells[2];
    const radius = radiusCell != null && String(radiusCell).trim() ? String(radiusCell).trim() : undefined;

    if (!query && !location) return; // fully blank row (trailing newline, etc.), skip silently
    if (!query || !location) {
      errors.push(`Row ${rowNum}: needs both a query and a location, got "${query || "(empty)"}" and "${location || "(empty)"}".`);
      return;
    }
    rows.push({ query, location, radius });
  });

  if (rows.length > MAX_BULK_SEARCH_ROWS) {
    errors.push(`Only the first ${MAX_BULK_SEARCH_ROWS} rows will be queued (the file has ${rows.length}). Split a larger list into multiple uploads.`);
    rows.length = MAX_BULK_SEARCH_ROWS;
  }

  return { rows, errors };
}
