"use client";

import { create } from "zustand";

export type LeadStatus = "verified" | "needs_enrich" | "pending" | "failed";

export interface Lead {
  id: string;
  sessionId: string;
  businessName: string;
  location: string;
  phone: string;
  email: string;
  status: LeadStatus;
  createdAt: number;
}

export interface ViewingSession {
  id: string;
  query: string;
  location: string;
}

export type SortColumn = keyof Lead | null;
export type SortDirection = "asc" | "desc";
export type StatusFilter = "all" | LeadStatus;

interface LeadsState {
  leads: Lead[];
  selectedIds: Set<string>;
  searchQuery: string;
  statusFilter: StatusFilter;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  currentPage: number;
  pageSize: number;
  enrichingId: string | null;
  enrichError: string | null;
  viewingSession: ViewingSession | null;

  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setSearch: (query: string) => void;
  setStatusFilter: (filter: StatusFilter) => void;
  setSort: (column: SortColumn) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  triggerEnrich: (id: string) => Promise<void>;
  addLeads: (newLeads: Lead[]) => void;
  updateLead: (id: string, patch: Partial<Pick<Lead, "status" | "email" | "phone">>) => void;
  removeLeads: (ids: string[]) => void;
  replaceLeads: (newLeads: Lead[]) => void;
  setViewingSession: (session: ViewingSession | null) => void;
}

export function sortLeads(leads: Lead[], column: SortColumn, direction: SortDirection): Lead[] {
  if (!column) return leads;
  return [...leads].sort((a, b) => {
    const aVal = a[column] ?? "";
    const bVal = b[column] ?? "";
    const aEmpty = String(aVal) === "";
    const bEmpty = String(bVal) === "";
    // Blank values (no email/phone found yet) always sort last regardless of
    // direction. Sorting a column like Email is almost always "show me who
    // has one first" — ascending order previously put empty strings first
    // (nothing sorts before ""), so the first click showed only blanks and
    // it took a second click (flipping to descending, which incidentally
    // puts real values first) to see anything useful.
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    const cmp = String(aVal).localeCompare(String(bVal));
    return direction === "asc" ? cmp : -cmp;
  });
}

function filterLeads(leads: Lead[], query: string, statusFilter: StatusFilter): Lead[] {
  let filtered = leads;
  if (query.trim()) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (l) =>
        l.businessName.toLowerCase().includes(q) ||
        l.location.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        l.email.toLowerCase().includes(q),
    );
  }
  if (statusFilter !== "all") {
    filtered = filtered.filter((l) => l.status === statusFilter);
  }
  return filtered;
}

export const useLeadsStore = create<LeadsState>((set) => ({
  leads: [],
  selectedIds: new Set(),
  searchQuery: "",
  statusFilter: "all",
  sortColumn: null,
  sortDirection: "asc",
  currentPage: 1,
  pageSize: 25,
  enrichingId: null,
  enrichError: null,
  viewingSession: null,

  toggleSelect: (id) => {
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    });
  },

  selectAll: (ids) => {
    set((s) => {
      const allSelected = ids.every((id) => s.selectedIds.has(id));
      if (allSelected) {
        return { selectedIds: new Set() };
      }
      return { selectedIds: new Set(ids) };
    });
  },

  clearSelection: () => set({ selectedIds: new Set() }),

  setSearch: (query) => set({ searchQuery: query, currentPage: 1 }),

  setStatusFilter: (filter) => set({ statusFilter: filter, currentPage: 1 }),

  setSort: (column) => {
    set((s) => {
      if (s.sortColumn === column) {
        return { sortDirection: s.sortDirection === "asc" ? "desc" : "asc" };
      }
      return { sortColumn: column, sortDirection: "asc" };
    });
  },

  setPage: (page) => set({ currentPage: page }),

  setPageSize: (size) => set({ pageSize: size, currentPage: 1 }),

  // Was entirely fake: a setTimeout that hardcoded status to "verified"
  // after 2s with no API call at all. The table would show "Verified"
  // while the database (and the lead detail modal, which fetches real
  // data) still had the lead's actual pre-enrichment state — two views of
  // the same lead disagreeing because one of them was never real.
  triggerEnrich: async (id) => {
    set({ enrichingId: id, enrichError: null });
    try {
      const res = await fetch(`/api/enrich/${id}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        set({ enrichingId: null, enrichError: data.error || "Enrichment failed" });
        return;
      }
      set((s) => ({
        leads: s.leads.map((l) =>
          l.id === id
            ? { ...l, status: data.email ? "verified" : "needs_enrich", email: data.email || l.email }
            : l,
        ),
        enrichingId: null,
      }));
    } catch {
      set({ enrichingId: null, enrichError: "Enrichment failed — network error" });
    }
  },

  addLeads: (newLeads) => {
    set((s) => {
      const byId = new Map(s.leads.map((l) => [l.id, l]));
      const fresh: Lead[] = [];
      for (const lead of newLeads) {
        if (byId.has(lead.id)) {
          // Already in the table — this is a status/data refresh (e.g. the
          // "complete" broadcast at the end of a run), not a new row. Merge
          // in place instead of silently dropping the update, which used to
          // leave already-listed leads stuck on whatever status they had
          // when first added (usually "pending") until a full page reload.
          byId.set(lead.id, { ...byId.get(lead.id)!, ...lead });
        } else {
          byId.set(lead.id, lead);
          fresh.push(lead);
        }
      }
      return {
        leads: [...fresh, ...s.leads.map((l) => byId.get(l.id)!)],
        currentPage: fresh.length > 0 ? 1 : s.currentPage,
      };
    });
  },

  updateLead: (id, patch) => {
    set((s) => ({
      leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  },

  removeLeads: (ids) => {
    const idSet = new Set(ids);
    set((s) => {
      const next = new Set(s.selectedIds);
      for (const id of ids) next.delete(id);
      return {
        leads: s.leads.filter((l) => !idSet.has(l.id)),
        selectedIds: next,
      };
    });
  },

  replaceLeads: (newLeads) => set({ leads: newLeads, currentPage: 1 }),

  setViewingSession: (session) => set({ viewingSession: session }),
}));

export function useFilteredLeads() {
  const leads = useLeadsStore((s) => s.leads);
  const searchQuery = useLeadsStore((s) => s.searchQuery);
  const statusFilter = useLeadsStore((s) => s.statusFilter);
  const sortColumn = useLeadsStore((s) => s.sortColumn);
  const sortDirection = useLeadsStore((s) => s.sortDirection);
  const currentPage = useLeadsStore((s) => s.currentPage);
  const pageSize = useLeadsStore((s) => s.pageSize);

  const filtered = filterLeads(leads, searchQuery, statusFilter);
  const sorted = sortLeads(filtered, sortColumn, sortDirection);
  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const clampedPage = Math.min(currentPage, totalPages);
  const start = (clampedPage - 1) * pageSize;
  const paged = sorted.slice(start, start + pageSize);

  return {
    pagedLeads: paged,
    totalFiltered,
    totalPages,
    currentPage: clampedPage,
    pageSize,
  };
}
