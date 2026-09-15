"use client";

import type { MouseEvent } from "react";

export function ColumnResizeHandle({
  onMouseDown,
}: {
  onMouseDown: (e: MouseEvent) => void;
}) {
  return (
    <span
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      className="group absolute right-0 top-0 z-10 flex h-full w-2 -translate-x-1/2 cursor-col-resize touch-none select-none items-center justify-center hover:bg-primary/20 active:bg-primary/30"
    >
      {/* Always-visible thin divider so users can see where columns are
          draggable, not just discover it by accidentally hovering. */}
      <span className="h-3/5 w-px rounded-full bg-border transition-colors group-hover:w-0.5 group-hover:bg-primary" />
    </span>
  );
}
