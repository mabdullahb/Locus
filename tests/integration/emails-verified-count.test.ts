import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Regression: ISSUE-003. "Emails Verified" meant two different things. The
// dashboard's monthly stat counted verified leads, while the live card was
// fed "has any email" counts from the worker's final broadcast, the
// resumable-session hydration and the reconcile poll. One run showed 9 on
// the live card and 8 under This month. Every path now counts verified.
// Found by /qa on 2026-11-27.
// Report: .gstack/qa-reports/qa-report-localhost-2026-11-27.md

vi.mock("@/lib/db", () => ({
  prisma: {
    scrapeSession: { findMany: vi.fn() },
    businessLead: { count: vi.fn() },
  },
}));
vi.mock("@/lib/auth-helpers", () => ({
  requireUserId: vi.fn().mockResolvedValue("user-1"),
  unauthorized: () => new Response(null, { status: 401 }),
}));

import { prisma } from "@/lib/db";
import { GET as getResumable } from "@/app/api/scrape/resumable/route";
import { useScrapeWebSocket } from "@/hooks/useScrapeWebSocket";
import { useExtractionStore } from "@/stores/extraction-store";
import { useLeadsStore } from "@/stores/leads-store";

describe("GET /api/scrape/resumable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts verified leads for emailsVerified, not every lead with an email", async () => {
    (prisma.scrapeSession.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "s1", query: "bakeries", location: "Portland OR", totalYield: 65, config: { hasMore: true } },
    ]);
    const count = prisma.businessLead.count as ReturnType<typeof vi.fn>;
    count.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if (where.phone) return Promise.resolve(26);
      if (where.emailVerified === true) return Promise.resolve(27);
      if (where.status === "verified") return Promise.resolve(27);
      if (where.email) return Promise.resolve(28);
      return Promise.resolve(-1);
    });

    const body = await (await getResumable()).json();

    expect(body.session.emailsVerified).toBe(27);
    expect(count).toHaveBeenCalledWith({ where: { sessionId: "s1", emailVerified: true } });
    expect(count).not.toHaveBeenCalledWith({ where: { sessionId: "s1", email: { not: null } } });
  });
});

class DeadSocket {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  close() {}
}

describe("reconcile poll after a dropped WebSocket", () => {
  const originalWebSocket = global.WebSocket;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    // @ts-expect-error test double, not a full WebSocket implementation
    global.WebSocket = DeadSocket;
    useExtractionStore.setState({ status: "running", stage: "enriching", progress: 50, sessionId: "session-1" });
    useLeadsStore.setState({ leads: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
    global.WebSocket = originalWebSocket;
    global.fetch = originalFetch;
    useExtractionStore.setState({ status: "idle", sessionId: null });
  });

  it("fills Emails Verified from the verified count, not emails found", async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes("/api/history/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: "completed", yield: { leads: 25, phones: 0, emails: 9, enriched: 17, verified: 8 } }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ leads: [] }) });
    }) as unknown as typeof fetch;

    renderHook(() => useScrapeWebSocket("session-1"));
    await vi.advanceTimersByTimeAsync(8000);

    const s = useExtractionStore.getState();
    expect(s.status).toBe("complete");
    expect(s.emailsVerified).toBe(8);
    expect(s.fullyEnriched).toBe(8);
  });
});
