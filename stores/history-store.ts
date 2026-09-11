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
  replaceSessions: (sessions: HistorySession[]) => void;
  updateSession: (id: string, updates: Partial<HistorySession>) => void;
  removeSession: (id: string) => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  sessions: [],
  isPanelOpen: false,

  addSession: (session) =>
    set((s) => ({ sessions: [session, ...s.sessions] })),

  replaceSessions: (sessions) => set({ sessions }),

  updateSession: (id, updates) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, ...updates } : sess,
      ),
    })),

  removeSession: (id) =>
    set((s) => ({ sessions: s.sessions.filter((sess) => sess.id !== id) })),

  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),

  openPanel: () => set({ isPanelOpen: true }),

  closePanel: () => set({ isPanelOpen: false }),
}));
