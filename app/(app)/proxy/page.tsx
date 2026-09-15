import { CheckCircle2 } from "lucide-react";

export default function ProxyPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-[22px] font-semibold tracking-[-0.01em] text-foreground-strong">Proxy Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure proxy settings for extraction pipelines.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-6 w-6 text-primary" />
        </div>
        <h2 className="mb-2 font-display text-lg font-semibold text-foreground">
          Not applicable
        </h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground leading-relaxed">
          Your chosen extraction provider (SerpApi, Serper.dev, or Google Maps Places API)
          handles proxy rotation and IP management automatically on their end. No additional
          proxy configuration is needed.
        </p>
        <div className="mt-6 rounded-lg bg-muted/50 p-4 text-left text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">Why this is automatic:</p>
          <ul className="list-inside list-disc space-y-1">
            <li>SerpApi and Serper.dev each manage their own proxy pool across residential and datacenter IPs</li>
            <li>Google Places API serves data through Google&apos;s infrastructure directly</li>
            <li>All three providers handle rate limiting and request distribution for you</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
