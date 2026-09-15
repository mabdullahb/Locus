"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

const MIN_WIDTH = 60;

// Excel-style drag-to-resize column widths. Table layout must be "fixed"
// (via a <colgroup>) for explicit widths to actually stick — with the
// default "auto" layout the browser resizes columns to fit content and
// ignores anything set here. Widths persist per table (storageKey) so a
// resize sticks across reloads, same as Excel remembering column widths.
export function useResizableColumns(storageKey: string, defaults: Record<string, number>) {
  const [widths, setWidths] = useState<Record<string, number>>(defaults);
  const widthsRef = useRef(widths);

  useEffect(() => {
    widthsRef.current = widths;
  }, [widths]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        // localStorage can only be read client-side, so this can't be a
        // useState lazy initializer without causing a server/client
        // hydration mismatch, the server-rendered HTML has no access to it.
        // An effect is the correct, SSR-safe place for this one-time sync.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setWidths((w) => ({ ...w, ...(JSON.parse(saved) as Record<string, number>) }));
      }
    } catch {
      // Malformed or unavailable storage, fall back to defaults.
    }
  }, [storageKey]);

  const startResize = useCallback(
    (key: string) => (e: ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = widthsRef.current[key] ?? defaults[key] ?? 120;

      const onMove = (ev: MouseEvent) => {
        const next = Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX));
        setWidths((w) => ({ ...w, [key]: next }));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(widthsRef.current));
        } catch {
          // Storage unavailable (private browsing, quota) — resize still
          // works for the rest of this page view, just won't persist.
        }
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [defaults, storageKey],
  );

  return { widths, startResize };
}
