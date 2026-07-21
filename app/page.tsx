import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
          <span className="font-display text-xl font-bold text-primary-foreground">L</span>
        </div>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">
          Locus
        </h1>
        <p className="max-w-md text-muted-foreground">
          Enterprise Google Maps Intelligence Platform
        </p>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-border bg-background px-6 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
