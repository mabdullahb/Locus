import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AnimatedCount } from "@/components/ui/animated-count";

// Regression: ISSUE-002. The live extraction metrics had their own counter
// that returned early when the target became 0 without touching state. The
// dashboard hydrates the last resumable session on load (e.g. 26 phones),
// then a new run resets the store to 0, and the card kept showing 26. A run
// that genuinely found 0 results still showed the old session's numbers.
// Found by /qa on 2026-11-27.
// Report: .gstack/qa-reports/qa-report-localhost-2026-11-27.md
describe("AnimatedCount", () => {
  afterEach(() => vi.useRealTimers());

  it("counts up to the target", () => {
    vi.useFakeTimers();
    render(<span data-testid="n"><AnimatedCount target={26} /></span>);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId("n").textContent).toBe("26");
  });

  it("drops to 0 immediately when the target goes from a stale value to 0", () => {
    vi.useFakeTimers();
    const { rerender } = render(<span data-testid="n"><AnimatedCount target={26} /></span>);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId("n").textContent).toBe("26");

    rerender(<span data-testid="n"><AnimatedCount target={0} /></span>);
    expect(screen.getByTestId("n").textContent).toBe("0");
  });

  it("counts up again after a reset to 0", () => {
    vi.useFakeTimers();
    const { rerender } = render(<span data-testid="n"><AnimatedCount target={65} /></span>);
    act(() => vi.advanceTimersByTime(500));
    rerender(<span data-testid="n"><AnimatedCount target={0} /></span>);
    rerender(<span data-testid="n"><AnimatedCount target={9} /></span>);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId("n").textContent).toBe("9");
  });

  it("renders 0 for a zero target on first render", () => {
    render(<span data-testid="n"><AnimatedCount target={0} /></span>);
    expect(screen.getByTestId("n").textContent).toBe("0");
  });
});
