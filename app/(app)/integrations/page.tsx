"use client";

import { IntegrationsTab } from "@/app/(app)/settings/integrations-tab";

export default function IntegrationsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-[22px] font-semibold tracking-[-0.01em] text-foreground-strong">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect webhooks and CRM integrations to push your lead data anywhere.
        </p>
      </div>

      <IntegrationsTab />
    </div>
  );
}
