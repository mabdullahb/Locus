import * as XLSX from "xlsx";
import type { ExportColumn } from "./connectors/types";

// The full account export is several unrelated shapes (a single account
// record, one-to-many sessions/leads/enrichment logs) with no natural
// single-table layout, so a workbook with one sheet per entity keeps
// everything in one file without forcing unrelated columns together.
// Related sheets link back via id columns (sessionId, leadId) rather than
// nesting, the same way the underlying tables relate.

type Row = Record<string, unknown>;

function iso(value: Date | string | null | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.toISOString();
}

function addSheet(workbook: XLSX.WorkBook, sheetName: string, rows: Row[], columns: ExportColumn[]) {
  const picked = rows.map((row) => {
    const out: Row = {};
    for (const col of columns) out[col.label] = row[col.key] ?? "";
    return out;
  });
  // json_to_sheet on an empty array produces a sheet with no header row at
  // all — pass the column labels explicitly so an empty section still shows
  // its headers instead of looking broken/missing.
  const worksheet =
    picked.length > 0
      ? XLSX.utils.json_to_sheet(picked)
      : XLSX.utils.aoa_to_sheet([columns.map((c) => c.label)]);
  worksheet["!cols"] = columns.map((c) => ({ wch: Math.max(c.label.length, 12) }));
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

export interface AccountExportBundle {
  account: {
    id: string;
    name: string | null;
    email: string;
    createdAt: Date;
  } | null;
  scrapeSessions: Array<{
    id: string;
    query: string;
    location: string;
    radius: string;
    concurrency: number;
    proxyType: string;
    status: string;
    totalYield: number;
    startedAt: Date;
    completedAt: Date | null;
    duration: number | null;
    errorLog: string | null;
    businessLeads: Array<{
      id: string;
      sessionId: string;
      businessName: string;
      location: string;
      phone: string | null;
      email: string | null;
      emailVerified: boolean;
      website: string | null;
      category: string | null;
      lat: number | null;
      lng: number | null;
      status: string;
      createdAt: Date;
      enrichmentLogs: Array<{
        id: string;
        leadId: string;
        source: string;
        resultStatus: string;
        emailFound: boolean;
        errorMessage: string | null;
        enrichedAt: Date;
      }>;
    }>;
    proxySessions: Array<{
      id: string;
      sessionId: string;
      proxyIp: string;
      provider: string;
      successRate: number | null;
      requestsMade: number;
      blockedCount: number;
      createdAt: Date;
    }>;
  }>;
  apiKeys: Array<{
    id: string;
    provider: string;
    keyPrefix: string;
    model: string | null;
    isActive: boolean;
    createdAt: Date;
  }>;
  exportHistory: Array<{
    id: string;
    sessionId: string;
    format: string;
    fileSize: number | null;
    downloadedAt: Date;
  }>;
  webhookConfig: { webhookUrl: string; isActive: boolean; createdAt: Date } | null;
  connectorConfigs: Array<{
    connectorId: string;
    config: unknown;
    isActive: boolean;
    createdAt: Date;
  }>;
}

export function buildAccountDataXlsx(bundle: AccountExportBundle): Uint8Array {
  const workbook = XLSX.utils.book_new();

  addSheet(
    workbook,
    "Account",
    bundle.account ? [{ ...bundle.account, createdAt: iso(bundle.account.createdAt) }] : [],
    [
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "createdAt", label: "Joined" },
    ],
  );

  addSheet(
    workbook,
    "Sessions",
    bundle.scrapeSessions.map((s) => ({ ...s, startedAt: iso(s.startedAt), completedAt: iso(s.completedAt) })),
    [
      { key: "id", label: "Session ID" },
      { key: "query", label: "Query" },
      { key: "location", label: "Location" },
      { key: "radius", label: "Radius (km)" },
      { key: "concurrency", label: "Concurrency" },
      { key: "proxyType", label: "Proxy Type" },
      { key: "status", label: "Status" },
      { key: "totalYield", label: "Total Yield" },
      { key: "startedAt", label: "Started At" },
      { key: "completedAt", label: "Completed At" },
      { key: "duration", label: "Duration (s)" },
      { key: "errorLog", label: "Error Log" },
    ],
  );

  const leads: Row[] = [];
  const enrichmentLogs: Row[] = [];
  const proxySessions: Row[] = [];
  for (const session of bundle.scrapeSessions) {
    for (const lead of session.businessLeads) {
      leads.push({ ...lead, createdAt: iso(lead.createdAt) });
      for (const log of lead.enrichmentLogs) {
        enrichmentLogs.push({ ...log, enrichedAt: iso(log.enrichedAt) });
      }
    }
    for (const proxy of session.proxySessions) {
      proxySessions.push({ ...proxy, createdAt: iso(proxy.createdAt) });
    }
  }

  addSheet(workbook, "Leads", leads, [
    { key: "id", label: "Lead ID" },
    { key: "sessionId", label: "Session ID" },
    { key: "businessName", label: "Business Name" },
    { key: "location", label: "Location" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "emailVerified", label: "Email Verified" },
    { key: "website", label: "Website" },
    { key: "category", label: "Category" },
    { key: "lat", label: "Latitude" },
    { key: "lng", label: "Longitude" },
    { key: "status", label: "Status" },
    { key: "createdAt", label: "Created At" },
  ]);

  addSheet(workbook, "Enrichment Logs", enrichmentLogs, [
    { key: "id", label: "Log ID" },
    { key: "leadId", label: "Lead ID" },
    { key: "source", label: "Source" },
    { key: "resultStatus", label: "Result Status" },
    { key: "emailFound", label: "Email Found" },
    { key: "errorMessage", label: "Error Message" },
    { key: "enrichedAt", label: "Enriched At" },
  ]);

  addSheet(workbook, "Proxy Sessions", proxySessions, [
    { key: "id", label: "Proxy Session ID" },
    { key: "sessionId", label: "Session ID" },
    { key: "proxyIp", label: "Proxy IP" },
    { key: "provider", label: "Provider" },
    { key: "successRate", label: "Success Rate" },
    { key: "requestsMade", label: "Requests Made" },
    { key: "blockedCount", label: "Blocked Count" },
    { key: "createdAt", label: "Created At" },
  ]);

  addSheet(
    workbook,
    "API Keys",
    bundle.apiKeys.map((k) => ({ ...k, createdAt: iso(k.createdAt) })),
    [
      { key: "id", label: "Key ID" },
      { key: "provider", label: "Provider" },
      { key: "keyPrefix", label: "Key Prefix" },
      { key: "model", label: "Model" },
      { key: "isActive", label: "Active" },
      { key: "createdAt", label: "Created At" },
    ],
  );

  addSheet(
    workbook,
    "Export History",
    bundle.exportHistory.map((h) => ({ ...h, downloadedAt: iso(h.downloadedAt) })),
    [
      { key: "id", label: "Export ID" },
      { key: "sessionId", label: "Session ID" },
      { key: "format", label: "Format" },
      { key: "fileSize", label: "File Size (bytes)" },
      { key: "downloadedAt", label: "Downloaded At" },
    ],
  );

  addSheet(
    workbook,
    "Webhook Config",
    bundle.webhookConfig ? [{ ...bundle.webhookConfig, createdAt: iso(bundle.webhookConfig.createdAt) }] : [],
    [
      { key: "webhookUrl", label: "Webhook URL" },
      { key: "isActive", label: "Active" },
      { key: "createdAt", label: "Created At" },
    ],
  );

  addSheet(
    workbook,
    "Connector Configs",
    bundle.connectorConfigs.map((c) => ({ ...c, config: JSON.stringify(c.config), createdAt: iso(c.createdAt) })),
    [
      { key: "connectorId", label: "Connector" },
      { key: "config", label: "Config" },
      { key: "isActive", label: "Active" },
      { key: "createdAt", label: "Created At" },
    ],
  );

  const raw = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new Uint8Array(raw as ArrayBuffer | SharedArrayBuffer);
}
