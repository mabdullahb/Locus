const BASE = "/api";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

interface SessionListItem {
  id: string; query: string; location: string; status: string;
  yield: Record<string, number>; startedAt: number;
  completedAt: number | null; duration: number | null; errorLog: string | null;
}

interface HistoryListResponse {
  sessions: SessionListItem[]; total: number;
  totalPages: number; currentPage: number; pageSize: number;
}

interface LeadListItem {
  id: string; businessName: string; location: string;
  phone: string; email: string; status: string; createdAt: number;
}

interface LeadListResponse {
  leads: LeadListItem[]; total: number;
  totalPages: number; currentPage: number; pageSize: number;
}

export const api = {
  history: {
    list: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : "";
      return fetchJson<HistoryListResponse>(`/history${qs}`);
    },
    get: (id: string) => fetchJson<Record<string, unknown>>(`/history/${id}`),
    rerun: (id: string) =>
      fetchJson<{ status: string; config: Record<string, unknown> }>(`/history/${id}/rerun`, { method: "POST" }),
  },

  scrape: {
    start: (config: Record<string, unknown>) =>
      fetchJson<{ sessionId: string; status: string }>("/scrape", {
        method: "POST",
        body: JSON.stringify(config),
      }),
  },

  leads: {
    list: (params?: Record<string, string>) =>
      fetchJson<LeadListResponse>(
        `/leads${params ? "?" + new URLSearchParams(params).toString() : ""}`
      ),
  },

  export: {
    create: (sessionId: string, format: string) =>
      fetchJson<{ status: string; downloadUrl: string }>("/export", {
        method: "POST",
        body: JSON.stringify({ sessionId, format }),
      }),
  },

  enrich: {
    trigger: (leadId: string) =>
      fetchJson<{ leadId: string; status: string }>(`/enrich/${leadId}`, { method: "POST" }),
  },
};
