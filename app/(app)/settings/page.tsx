"use client";

import { useState, useEffect, useCallback } from "react";
import { AccountDetailsTab } from "./account-details-tab";
import { SecurityTab } from "./security-tab";
import { DataPrivacyTab } from "./data-privacy-tab";
import { DangerZoneTab } from "./danger-zone-tab";

export interface Account {
  name: string | null;
  email: string;
}

export default function SettingsPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);

  // Fetched once here instead of independently by AccountDetailsTab and
  // DangerZoneTab (both used to call GET /api/account on mount) — this page
  // renders every settings section at once rather than switching between
  // tabs, so two components fetching the same account data doubled the
  // request count for no reason.
  const fetchAccount = useCallback(() => {
    setAccountLoading(true);
    return fetch("/api/account")
      .then((res) => res.json())
      .then((data) => setAccount(data.user))
      .catch(() => {})
      .finally(() => setAccountLoading(false));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchAccount();
    });
  }, [fetchAccount]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-[22px] font-semibold tracking-[-0.01em] text-foreground-strong">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account, security, and privacy. API keys and
          integrations each have their own page in the sidebar.
        </p>
      </div>

      <AccountDetailsTab account={account} loading={accountLoading} onAccountUpdate={setAccount} />
      <SecurityTab />
      <DataPrivacyTab />
      <DangerZoneTab email={account?.email ?? ""} />
    </div>
  );
}
