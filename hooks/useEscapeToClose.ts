import { useEffect } from "react";

/**
 * Closes a modal/dialog on Escape. Backdrop click and an explicit close
 * button aren't enough on their own, Escape is the convention users reach
 * for first, and none of the app's modals wired it up.
 */
export function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
}
