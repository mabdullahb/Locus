import Link from "next/link";
import { LocusLogo } from "@/components/brand/logo";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="flex flex-col items-center gap-8 text-center">
        <LocusLogo className="w-[min(88vw,520px)] text-foreground-strong" />
        <p className="max-w-md text-[15px] text-muted-foreground">
          Turn Google Maps business listings into enriched, sales-ready leads
          with verified emails.
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="rounded-md bg-primary px-6 py-2.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-input px-6 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
