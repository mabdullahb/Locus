import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useExtractionStore } from "@/stores/extraction-store";
import { LiveMetricsRow } from "@/components/dashboard/live-metrics-row";

// Regression: ISSUE-002. Reproduces the real sequence: the dashboard hydrates
// the last resumable session (65 locations, 26 phones), the user starts a new
// search, the store resets to 0. The cards kept showing 65 and 26, and a run
// that found nothing finished showing "65 Locations Found".
// Found by /qa on 2026-11-27.
// Report: .gstack/qa-reports/qa-report-localhost-2026-11-27.md
function cardText(label: string) {
  return screen.getByText(label).parentElement!.parentElement!.textContent ?? "";
}

describe("LiveMetricsRow", () => {
  afterEach(() => {
    vi.useRealTimers();
    useExtractionStore.setState({ status: "idle", locationsFound: 0, phonesExtracted: 0, emailsVerified: 0, fullyEnriched: 0 });
  });

  it("drops stale hydrated numbers to 0 when a new run resets the store", () => {
    vi.useFakeTimers();
    useExtractionStore.setState({ status: "complete", locationsFound: 65, phonesExtracted: 26, emailsVerified: 28, fullyEnriched: 28 });
    render(<LiveMetricsRow />);
    act(() => vi.advanceTimersByTime(500));
    expect(cardText("Phones Extracted")).toContain("26");

    act(() => useExtractionStore.setState({ status: "running", locationsFound: 0, phonesExtracted: 0, emailsVerified: 0, fullyEnriched: 0 }));
    for (const label of ["Locations Found", "Phones Extracted", "Emails Verified", "Fully Enriched"]) {
      expect(cardText(label)).toBe(`${label}0`);
    }
  });

  it("shows the new run's numbers once they arrive", () => {
    vi.useFakeTimers();
    useExtractionStore.setState({ status: "running", locationsFound: 0, phonesExtracted: 0, emailsVerified: 0, fullyEnriched: 0 });
    render(<LiveMetricsRow />);
    act(() => useExtractionStore.setState({ status: "complete", locationsFound: 25, phonesExtracted: 0, emailsVerified: 8, fullyEnriched: 8 }));
    act(() => vi.advanceTimersByTime(500));
    expect(cardText("Locations Found")).toBe("Locations Found25");
    expect(cardText("Phones Extracted")).toBe("Phones Extracted0");
    expect(cardText("Emails Verified")).toBe("Emails Verified8");
  });

  it("renders nothing while idle", () => {
    useExtractionStore.setState({ status: "idle" });
    const { container } = render(<LiveMetricsRow />);
    expect(container.textContent).toBe("");
  });
});
