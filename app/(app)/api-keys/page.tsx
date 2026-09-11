"use client";

import { ApiKeysTab } from "@/app/(app)/settings/api-keys-tab";

export default function ApiKeysPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-[22px] font-semibold tracking-[-0.01em] text-foreground-strong">API Keys</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your API keys for business search and email enrichment.
        </p>
      </div>

      <ApiKeysTab />
    </div>
  );
}
