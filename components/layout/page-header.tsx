import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The running head shown at the top of every page. Title and metadata sit
 * on the same line, left-aligned together, separated by a dash. See
 * DESIGN.md, Layout.
 */
export function PageHeader({
  title,
  meta,
  className,
}: {
  title: string;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-3",
        className,
      )}
    >
      <h1 className="font-display text-[22px] font-semibold leading-none tracking-[-0.01em] text-foreground-strong">
        {title}
      </h1>
      {meta ? (
        <div className="font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.08em] text-muted-foreground">
          <span className="mr-3 text-muted-foreground/60">-</span>
          {meta}
        </div>
      ) : null}
    </header>
  );
}
