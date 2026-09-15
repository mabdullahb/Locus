"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

// The app had no error boundary anywhere (no error.tsx in any segment), so an
// uncaught render error in a client component unmounted the whole React tree
// with nothing left on screen: a genuinely blank tab, no message, no way to
// recover short of a manual reload. This surfaces it and offers a way back.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled render error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <div>
        <p className="font-display text-lg font-semibold text-foreground-strong">
          Something went wrong
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred while rendering this page."}
        </p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Try again
      </button>
    </div>
  );
}
