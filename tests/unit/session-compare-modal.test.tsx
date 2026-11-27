import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SessionCompareModal } from "@/components/history/session-compare-modal";

// Covers the modal's fetch state machine after it was reworked to derive
// "loading" from which id pair the stored result belongs to, instead of
// calling setState synchronously inside the effect.
function session(id: string, query: string) {
  return {
    id,
    query,
    location: "Berlin",
    status: "completed",
    startedAt: 0,
    completedAt: 1000,
    duration: 1000,
    yield: { leads: 1, emails: 1, phones: 1, enriched: 1 },
    statusBreakdown: { verified: 1, needs_enrich: 0, pending: 0, failed: 0 },
  };
}

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

describe("SessionCompareModal", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("shows loading, then both sessions in the requested order even if the API reorders them", async () => {
    global.fetch = vi.fn(() =>
      jsonResponse({ sessions: [session("b", "Query B"), session("a", "Query A")] }),
    ) as typeof fetch;

    render(<SessionCompareModal ids={["a", "b"]} onClose={() => {}} />);
    expect(screen.getByText("Loading...")).toBeTruthy();

    await waitFor(() => expect(screen.getByText("Query A")).toBeTruthy());
    const queries = screen.getAllByText(/^Query [AB]$/).map((el) => el.textContent);
    expect(queries).toEqual(["Query A", "Query B"]);
  });

  it("shows the error message when the request fails", async () => {
    global.fetch = vi.fn(() => jsonResponse({}, false)) as typeof fetch;
    render(<SessionCompareModal ids={["a", "b"]} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("Failed to load comparison")).toBeTruthy());
  });

  it("shows a fallback when only one session comes back", async () => {
    global.fetch = vi.fn(() => jsonResponse({ sessions: [session("a", "Query A")] })) as typeof fetch;
    render(<SessionCompareModal ids={["a", "b"]} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("Couldn't load both sessions.")).toBeTruthy());
  });

  it("does not refetch when the parent re-renders with a new array holding the same ids", async () => {
    const fetchMock = vi.fn(() =>
      jsonResponse({ sessions: [session("a", "Query A"), session("b", "Query B")] }),
    );
    global.fetch = fetchMock as typeof fetch;

    const { rerender } = render(<SessionCompareModal ids={["a", "b"]} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("Query A")).toBeTruthy());
    rerender(<SessionCompareModal ids={["a", "b"]} onClose={() => {}} />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Loading...")).toBeNull();
  });

  it("goes back to loading and fetches again when a different pair is selected", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        jsonResponse({ sessions: [session("a", "Query A"), session("b", "Query B")] }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({ sessions: [session("c", "Query C"), session("d", "Query D")] }),
      );
    global.fetch = fetchMock as typeof fetch;

    const { rerender } = render(<SessionCompareModal ids={["a", "b"]} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("Query A")).toBeTruthy());

    rerender(<SessionCompareModal ids={["c", "d"]} onClose={() => {}} />);
    expect(screen.getByText("Loading...")).toBeTruthy();
    expect(screen.queryByText("Query A")).toBeNull();
    await waitFor(() => expect(screen.getByText("Query C")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
