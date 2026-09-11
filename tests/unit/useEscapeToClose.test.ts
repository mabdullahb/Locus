import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

// Regression: neither LeadDetailModal nor the bulk-delete confirm modal
// closed on Escape, only on a backdrop click or their explicit close
// button. Escape is the convention users reach for first.
describe("useEscapeToClose", () => {
  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeToClose(onClose));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose for other keys", () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeToClose(onClose));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("removes its listener on unmount", () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useEscapeToClose(onClose));
    unmount();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(onClose).not.toHaveBeenCalled();
  });
});
