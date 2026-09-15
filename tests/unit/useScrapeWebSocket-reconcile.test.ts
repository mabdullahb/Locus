import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useScrapeWebSocket } from "@/hooks/useScrapeWebSocket";
import { useExtractionStore } from "@/stores/extraction-store";
import { useLeadsStore } from "@/stores/leads-store";

// Regression: the WebSocket has no onclose/reconnect handling. If it drops
// (worker restart, network blip) after the store already thinks a run is
// "running", the UI froze on the last stage forever, even after the
// extraction had actually finished server-side (confirmed live: a real
// extraction completed with 9 leads in the DB while the dashboard still
// showed "started extraction"). The fix is a poll that periodically
// re-checks the real session status and reconciles the store if a
// WebSocket message never arrives.
class DeadSocket {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  close() {}
}

describe("useScrapeWebSocket reconciliation poll", () => {
  const originalWebSocket = global.WebSocket;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    // @ts-expect-error test double, not a full WebSocket implementation
    global.WebSocket = DeadSocket;
    useExtractionStore.setState({
      status: "running",
      stage: "enriching",
      progress: 50,
      sessionId: "session-1",
    });
    useLeadsStore.setState({ leads: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
    global.WebSocket = originalWebSocket;
    global.fetch = originalFetch;
    useExtractionStore.setState({ status: "idle", sessionId: null });
  });

  it("marks the extraction complete once the DB says so, even with no WebSocket message", async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes("/api/history/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: "completed",
              yield: { leads: 9, phones: 5, emails: 3, enriched: 3 },
              errorLog: null,
            }),
        });
      }
      if (url.includes("/api/leads")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              leads: [{ id: "l1", businessName: "Acme", location: "NY", phone: "", email: "", status: "verified", createdAt: 1 }],
            }),
        });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;

    renderHook(() => useScrapeWebSocket("session-1"));

    await vi.advanceTimersByTimeAsync(8000);

    expect(useExtractionStore.getState().status).toBe("complete");
    expect(useExtractionStore.getState().locationsFound).toBe(9);
    expect(useLeadsStore.getState().leads).toHaveLength(1);
  });

  it("marks the extraction failed if the DB says so", async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes("/api/history/")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ status: "failed", errorLog: "Serper.dev HTTP 400: Not enough credits" }),
        });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;

    renderHook(() => useScrapeWebSocket("session-1"));

    await vi.advanceTimersByTimeAsync(8000);

    expect(useExtractionStore.getState().status).toBe("error");
    expect(useExtractionStore.getState().errorMessage).toContain("Not enough credits");
  });

  it("does not poll once the store is no longer running", async () => {
    useExtractionStore.setState({ status: "complete" });
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    renderHook(() => useScrapeWebSocket("session-1"));

    await vi.advanceTimersByTimeAsync(8000);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
