import * as XLSX from "xlsx";
import type { ExportColumn } from "./connectors/types";

export type ExportFormat = "csv" | "xlsx" | "json";

export interface ExportOptions {
  format: ExportFormat;
  columns: ExportColumn[];
  data: Record<string, unknown>[];
  filename?: string;
}

export interface ExportResult {
  buffer: Uint8Array;
  filename: string;
  mimeType: string;
  size: number;
}

const encoder = new TextEncoder();

function buildFilename(base: string, format: ExportFormat): string {
  const ext = format === "xlsx" ? "xlsx" : format;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${base}-${timestamp}.${ext}`;
}

function pickFields(rows: Record<string, unknown>[], columns: ExportColumn[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const picked: Record<string, unknown> = {};
    for (const col of columns) {
      picked[col.label] = row[col.key] ?? "";
    }
    return picked;
  });
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvBytes(rows: Record<string, unknown>[], columns: ExportColumn[]): Uint8Array {
  const headers = columns.map((c) => escapeCsvField(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCsvField(String(row[c.key] ?? ""))).join(","))
    .join("\n");
  return encoder.encode(`${headers}\n${body}`);
}

function toXlsxBytes(rows: Record<string, unknown>[], columns: ExportColumn[]): Uint8Array {
  const picked = pickFields(rows, columns);
  const worksheet = XLSX.utils.json_to_sheet(picked);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

  const colWidths = columns.map((col) => ({
    wch: Math.max(col.label.length, 12),
  }));
  worksheet["!cols"] = colWidths;

  const raw = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new Uint8Array(raw as ArrayBuffer | SharedArrayBuffer);
}

function toJsonBytes(rows: Record<string, unknown>[], columns: ExportColumn[]): Uint8Array {
  const picked = pickFields(rows, columns);
  return encoder.encode(JSON.stringify(picked, null, 2));
}

const MIME_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  json: "application/json",
};

export function generateExport(options: ExportOptions): ExportResult {
  const { format, columns, data, filename: baseFilename } = options;
  const filename = buildFilename(baseFilename ?? "locus-export", format);
  const mimeType = MIME_TYPES[format];

  let buffer: Uint8Array;

  switch (format) {
    case "csv":
      buffer = toCsvBytes(data, columns);
      break;
    case "xlsx":
      buffer = toXlsxBytes(data, columns);
      break;
    case "json":
      buffer = toJsonBytes(data, columns);
      break;
  }

  return { buffer, filename, mimeType, size: buffer.length };
}

export function parseExportFormat(value: string): ExportFormat | null {
  if (value === "csv" || value === "xlsx" || value === "json") return value;
  return null;
}
