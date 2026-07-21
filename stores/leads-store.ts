"use client";

import { create } from "zustand";

export type LeadStatus = "verified" | "needs_enrich" | "pending" | "failed";

export interface Lead {
  id: string;
  businessName: string;
  location: string;
  phone: string;
  email: string;
  status: LeadStatus;
  createdAt: number;
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

  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setSearch: (query: string) => void;
  setStatusFilter: (filter: StatusFilter) => void;
  setSort: (column: SortColumn) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  triggerEnrich: (id: string) => void;
  addLeads: (newLeads: Lead[]) => void;
}

const businesses = [
  { name: "TechNova Solutions", location: "HITEC City, Hyderabad", phone: "+91 40 4123 4567", email: "info@technova.in" },
  { name: "Sahaj Software Services", location: "Koramangala, Bangalore", phone: "+91 80 2345 6789", email: "contact@sahajsoft.com" },
  { name: "Greenfield Analytics", location: "Shivaji Nagar, Pune", phone: "+91 20 3456 7890", email: "hello@greenfield.in" },
  { name: "MapMyLead Technologies", location: "Banjara Hills, Hyderabad", phone: "+91 40 5678 9012", email: "sales@mapmylead.com" },
  { name: "Apex Digital Marketing", location: "Andheri East, Mumbai", phone: "+91 22 6789 0123", email: "info@apexdigital.co" },
  { name: "Crimson Consulting Group", location: "Indiranagar, Bangalore", phone: "+91 80 7890 1234", email: "team@crimson.in" },
  { name: "DataWeave Labs", location: "Sector 62, Noida", phone: "+91 120 456 7890", email: "hello@dataweave.com" },
  { name: "Orbit Research Intl", location: "Viman Nagar, Pune", phone: "+91 20 5678 9012", email: "info@orbitresearch.in" },
  { name: "Prism Revenue Systems", location: "Alwarpet, Chennai", phone: "+91 44 3456 7890", email: "sales@prismrevenue.com" },
  { name: "Elevate Growth Partners", location: "Salt Lake, Kolkata", phone: "+91 33 4567 8901", email: "hello@elevate.in" },
  { name: "NexGen B2B Solutions", location: "MG Road, Bangalore", phone: "+91 80 5678 9012", email: "info@nexgenb2b.com" },
  { name: "Stratify Consulting", location: "Jubilee Hills, Hyderabad", phone: "+91 40 6789 0123", email: "contact@stratify.in" },
  { name: "VantagePoint Advisory", location: "R A Puram, Chennai", phone: "+91 44 7890 1234", email: "team@vantagepoint.in" },
  { name: "CloudPulse Technologies", location: "Whitefield, Bangalore", phone: "+91 80 8901 2345", email: "info@cloudpulse.io" },
  { name: "Blue Ocean Research", location: "Koregaon Park, Pune", phone: "+91 20 9012 3456", email: "hello@blueocean.in" },
  { name: "IronClad Data Services", location: "Connaught Place, Delhi", phone: "+91 11 2345 6789", email: "info@ironcladdata.com" },
  { name: "SilverOak Marketing", location: "Navrangpura, Ahmedabad", phone: "+91 79 3456 7890", email: "contact@silveroak.in" },
  { name: "FusionLead Technologies", location: "HSR Layout, Bangalore", phone: "+91 80 4567 8901", email: "hello@fusionlead.com" },
  { name: "Pinnacle Growth Labs", location: "Gachibowli, Hyderabad", phone: "+91 40 5678 9012", email: "sales@pinnacle.in" },
  { name: "Zenith Market Research", location: "Electronic City, Bangalore", phone: "+91 80 6789 0123", email: "info@zenithmr.in" },
  { name: "AccelQuest Solutions", location: "Thane West, Mumbai", phone: "+91 22 7890 1234", email: "team@accelquest.com" },
  { name: "BrightPath Media", location: "Sadashiv Nagar, Bangalore", phone: "+91 80 8901 2345", email: "hello@brightpath.in" },
  { name: "CatalystIQ Consulting", location: "Nungambakkam, Chennai", phone: "+91 44 9012 3456", email: "info@catalystiq.com" },
  { name: "Neuralytics Software", location: "Ameerpet, Hyderabad", phone: "+91 40 1234 5678", email: "contact@neuralytics.in" },
  { name: "SkyBridge Advisors", location: "Model Town, Delhi", phone: "+91 11 3456 7890", email: "info@skybridge.in" },
];

const statuses: LeadStatus[] = ["verified", "needs_enrich", "pending", "failed"];

function generateLeads(): Lead[] {
  return businesses.map((b, i) => ({
    id: `lead-${i + 1}`,
    businessName: b.name,
    location: b.location,
    phone: b.phone,
    email: b.email,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    createdAt: Date.now() - Math.floor(Math.random() * 86400000 * 7),
  }));
}

const initialLeads = generateLeads();

function sortLeads(leads: Lead[], column: SortColumn, direction: SortDirection): Lead[] {
  if (!column) return leads;
  return [...leads].sort((a, b) => {
    const aVal = a[column] ?? "";
    const bVal = b[column] ?? "";
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

export const useLeadsStore = create<LeadsState>((set, get) => ({
  leads: initialLeads,
  selectedIds: new Set(),
  searchQuery: "",
  statusFilter: "all",
  sortColumn: null,
  sortDirection: "asc",
  currentPage: 1,
  pageSize: 25,
  enrichingId: null,

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

  triggerEnrich: (id) => {
    set({ enrichingId: id });
    setTimeout(() => {
      set((s) => ({
        leads: s.leads.map((l) => (l.id === id ? { ...l, status: "verified" as const } : l)),
        enrichingId: null,
      }));
    }, 2000);
  },

  addLeads: (newLeads) => {
    set((s) => ({ leads: [...newLeads, ...s.leads], currentPage: 1 }));
  },
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
