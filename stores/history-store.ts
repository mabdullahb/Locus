"use client";

import { create } from "zustand";

export type SessionStatus = "completed" | "failed" | "aborted" | "running";

export interface SessionConfig {
  keyword: string;
  location: string;
  radius: string;
  concurrency: number;
  proxyType: string;
  enrichmentDepth: string;
  maxResults: number;
  locale: string;
  renderDelay: number;
}

export interface HistorySession {
  id: string;
  query: string;
  location: string;
  status: SessionStatus;
  yield: {
    leads: number;
    emails: number;
    phones: number;
    enriched: number;
  };
  config: SessionConfig;
  startedAt: number;
  completedAt: number | null;
  duration: number | null;
  errorLog: string | null;
}

interface HistoryState {
  sessions: HistorySession[];
  isPanelOpen: boolean;

  addSession: (session: HistorySession) => void;
  updateSession: (id: string, updates: Partial<HistorySession>) => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
}

const now = Date.now();

const mockSessions: HistorySession[] = [
  {
    id: "hist-1",
    query: "Digital Marketing Agencies",
    location: "Hyderabad, Telangana",
    status: "completed",
    yield: { leads: 47, emails: 31, phones: 43, enriched: 28 },
    config: {
      keyword: "Digital Marketing Agencies",
      location: "Hyderabad, Telangana",
      radius: "25",
      concurrency: 8,
      proxyType: "residential",
      enrichmentDepth: "standard",
      maxResults: 100,
      locale: "en-IN",
      renderDelay: 500,
    },
    startedAt: now - 86400000 * 3,
    completedAt: now - 86400000 * 3 + 420000,
    duration: 420,
    errorLog: null,
  },
  {
    id: "hist-2",
    query: "IT Companies",
    location: "Whitefield, Bangalore",
    status: "completed",
    yield: { leads: 83, emails: 52, phones: 76, enriched: 48 },
    config: {
      keyword: "IT Companies",
      location: "Whitefield, Bangalore",
      radius: "10",
      concurrency: 16,
      proxyType: "residential",
      enrichmentDepth: "deep",
      maxResults: 200,
      locale: "en-IN",
      renderDelay: 800,
    },
    startedAt: now - 86400000 * 5,
    completedAt: now - 86400000 * 5 + 780000,
    duration: 780,
    errorLog: null,
  },
  {
    id: "hist-3",
    query: "Real Estate Developers",
    location: "Pune, Maharashtra",
    status: "failed",
    yield: { leads: 12, emails: 3, phones: 10, enriched: 0 },
    config: {
      keyword: "Real Estate Developers",
      location: "Pune, Maharashtra",
      radius: "50",
      concurrency: 4,
      proxyType: "datacenter",
      enrichmentDepth: "standard",
      maxResults: 150,
      locale: "en-IN",
      renderDelay: 500,
    },
    startedAt: now - 86400000,
    completedAt: now - 86400000 + 120000,
    duration: 120,
    errorLog: "CAPTCHA blocked after 12 records. Datacenter IP range blacklisted. Retry with residential proxies recommended.",
  },
  {
    id: "hist-4",
    query: "Co-working Spaces",
    location: "HITEC City, Hyderabad",
    status: "completed",
    yield: { leads: 34, emails: 22, phones: 31, enriched: 20 },
    config: {
      keyword: "Co-working Spaces",
      location: "HITEC City, Hyderabad",
      radius: "5",
      concurrency: 4,
      proxyType: "datacenter",
      enrichmentDepth: "basic",
      maxResults: 50,
      locale: "en-IN",
      renderDelay: 300,
    },
    startedAt: now - 86400000 * 7,
    completedAt: now - 86400000 * 7 + 300000,
    duration: 300,
    errorLog: null,
  },
  {
    id: "hist-5",
    query: "CA Firms",
    location: "Mumbai, Maharashtra",
    status: "aborted",
    yield: { leads: 8, emails: 2, phones: 6, enriched: 1 },
    config: {
      keyword: "CA Firms",
      location: "Mumbai, Maharashtra",
      radius: "25",
      concurrency: 8,
      proxyType: "residential",
      enrichmentDepth: "standard",
      maxResults: 100,
      locale: "en-IN",
      renderDelay: 500,
    },
    startedAt: now - 86400000 * 2,
    completedAt: now - 86400000 * 2 + 180000,
    duration: 180,
    errorLog: "User aborted — quota limit reached.",
  },
  {
    id: "hist-6",
    query: "Software Product Companies",
    location: "Koramangala, Bangalore",
    status: "completed",
    yield: { leads: 64, emails: 41, phones: 58, enriched: 38 },
    config: {
      keyword: "Software Product Companies",
      location: "Koramangala, Bangalore",
      radius: "10",
      concurrency: 8,
      proxyType: "residential",
      enrichmentDepth: "deep",
      maxResults: 150,
      locale: "en-IN",
      renderDelay: 500,
    },
    startedAt: now - 86400000 * 10,
    completedAt: now - 86400000 * 10 + 600000,
    duration: 600,
    errorLog: null,
  },
  {
    id: "hist-7",
    query: "Hospitals & Clinics",
    location: "Chennai, Tamil Nadu",
    status: "failed",
    yield: { leads: 0, emails: 0, phones: 0, enriched: 0 },
    config: {
      keyword: "Hospitals & Clinics",
      location: "Chennai, Tamil Nadu",
      radius: "25",
      concurrency: 4,
      proxyType: "datacenter",
      enrichmentDepth: "standard",
      maxResults: 100,
      locale: "en-IN",
      renderDelay: 500,
    },
    startedAt: now - 86400000 * 4,
    completedAt: now - 86400000 * 4 + 30000,
    duration: 30,
    errorLog: "All 4 proxies blocked immediately. Zero records extracted. Switch to residential proxy pool.",
  },
  {
    id: "hist-8",
    query: "E-commerce Platforms",
    location: "Delhi NCR",
    status: "completed",
    yield: { leads: 52, emails: 33, phones: 48, enriched: 30 },
    config: {
      keyword: "E-commerce Platforms",
      location: "Delhi NCR",
      radius: "50",
      concurrency: 16,
      proxyType: "residential",
      enrichmentDepth: "standard",
      maxResults: 200,
      locale: "en-IN",
      renderDelay: 500,
    },
    startedAt: now - 86400000 * 6,
    completedAt: now - 86400000 * 6 + 540000,
    duration: 540,
    errorLog: null,
  },
];

export const useHistoryStore = create<HistoryState>((set) => ({
  sessions: mockSessions,
  isPanelOpen: false,

  addSession: (session) =>
    set((s) => ({ sessions: [session, ...s.sessions] })),

  updateSession: (id, updates) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, ...updates } : sess,
      ),
    })),

  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),

  openPanel: () => set({ isPanelOpen: true }),

  closePanel: () => set({ isPanelOpen: false }),
}));
