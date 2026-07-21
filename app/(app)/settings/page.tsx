"use client";

import { useState } from "react";
import { Key, Puzzle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiKeysTab } from "./api-keys-tab";
import { IntegrationsTab } from "./integrations-tab";

const tabs = [
  { id: "api-keys", label: "API Keys", icon: Key },
  { id: "integrations", label: "Integrations", icon: Puzzle },
] as const;

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"api-keys" | "integrations">("api-keys");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account, API keys, and integrations.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "api-keys" ? <ApiKeysTab /> : <IntegrationsTab />}
    </div>
  );
}
