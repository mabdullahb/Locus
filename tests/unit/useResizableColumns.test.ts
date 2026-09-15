import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useResizableColumns } from "@/hooks/useResizableColumns";

// Excel-style drag-to-resize columns: dragging right should grow a column,
// dragging left should shrink it (clamped to a sane minimum), and the final
// width should persist to localStorage so it survives a reload.
describe("useResizableColumns", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function drag(key: string, startX: number, endX: number) {
    const { result } = renderHook(() =>
      useResizableColumns("test:widths", { [key]: 150 }),
    );

    act(() => {
      result.current.startResize(key)({
        preventDefault: () => {},
        stopPropagation: () => {},
        clientX: startX,
      } as unknown as React.MouseEvent);
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: endX }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup"));
    });

    return result;
  }

  it("grows the column width by the drag distance", () => {
    const result = drag("phone", 100, 220);
    expect(result.current.widths.phone).toBe(270);
  });

  it("shrinks the column width when dragging left", () => {
    const result = drag("phone", 200, 150);
    expect(result.current.widths.phone).toBe(100);
  });

  it("clamps to a minimum width instead of going negative or tiny", () => {
    const result = drag("phone", 200, -1000);
    expect(result.current.widths.phone).toBe(60);
  });

  it("persists the resized width to localStorage", () => {
    drag("phone", 100, 220);
    const saved = JSON.parse(window.localStorage.getItem("test:widths") ?? "{}");
    expect(saved.phone).toBe(270);
  });

  it("restores a previously persisted width on mount", () => {
    window.localStorage.setItem("test:widths", JSON.stringify({ phone: 300 }));
    const { result } = renderHook(() =>
      useResizableColumns("test:widths", { phone: 150 }),
    );
    expect(result.current.widths.phone).toBe(300);
  });
});
