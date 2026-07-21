"use client";

import { useState, useEffect } from "react";
import {
  Webhook,
  Building2,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link2,
  Unlink,
  ExternalLink,
  TestTube,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectorDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  isBuiltIn: boolean;
}

interface WebhookData {
  webhookUrl: string;
  secret: string | null;
  isActive: boolean;
}

interface SavedConnector {
  id: string;
  connectorId: string;
  isActive: boolean;
  config: Record<string, string>;
}

const connectorIcons: Record<string, typeof Webhook> = {
  webhook: Webhook,
  hubspot: Building2,
  salesforce: Cloud,
};

export function IntegrationsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [webhook, setWebhook] = useState<WebhookData | null>(null);
  const [definitions, setDefinitions] = useState<ConnectorDefinition[]>([]);
  const [savedConnectors, setSavedConnectors] = useState<SavedConnector[]>([]);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/connectors");
      const data = await res.json();
      setWebhook(data.webhook);
      setDefinitions(data.definitions || []);
      setSavedConnectors(data.connectors || []);
      if (data.webhook) {
        setWebhookUrl(data.webhook.webhookUrl || "");
        setWebhookSecret(data.webhook.secret || "");
      }
    } catch {
      setError("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const saveWebhook = async () => {
    if (!webhookUrl.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, string> = { webhookUrl: webhookUrl.trim() };
      if (webhookSecret.trim()) payload.secret = webhookSecret.trim();

      const res = await fetch("/api/settings/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "webhook", config: payload }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save webhook");
      }

      setSuccess("Webhook URL saved");
      await fetchData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const removeWebhook = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/settings/connectors?type=webhook", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove webhook");
      setWebhookUrl("");
      setWebhookSecret("");
      setSuccess("Webhook removed");
      await fetchData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const testWebhook = async () => {
    setTesting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/export/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "__test__",
          testPayload: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`Webhook test: ${data.message}`);
      } else {
        setError(`Webhook test failed: ${data.error || data.message}`);
      }
    } catch (err) {
      setError(`Test error: ${(err as Error).message}`);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading integrations...
      </div>
    );
  }

  const webhookDef = definitions.find((d) => d.id === "webhook");
  const comingSoonDefs = definitions.filter((d) => !d.isBuiltIn);

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-3">
          <Webhook className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Webhook URL
            </h2>
            <p className="text-xs text-muted-foreground">
              {webhookDef?.description ?? "Send data to any webhook endpoint."}
            </p>
          </div>
          {webhook?.isActive ? (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-600">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </span>
          ) : (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
              <Unlink className="h-3 w-3" />
              Not configured
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Endpoint URL
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.example.com/endpoint"
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Compatible with n8n, Zapier, Make, and any HTTP endpoint. Data is sent
              as a JSON POST request.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Secret <span className="text-xs text-muted-foreground">(optional)</span>
            </label>
            <input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Shared secret for HMAC signing"
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              If set, sent as <code className="rounded bg-muted px-1">X-Webhook-Secret</code> header.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={saveWebhook}
              disabled={saving || !webhookUrl.trim()}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {webhook ? "Update Webhook" : "Save Webhook"}
            </button>

            {webhook && (
              <>
                <button
                  onClick={testWebhook}
                  disabled={testing}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                  Test
                </button>
                <button
                  onClick={removeWebhook}
                  disabled={saving}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-3">
          <Building2 className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              CRM Integrations
            </h2>
            <p className="text-xs text-muted-foreground">
              Push leads directly to your CRM. Configure once, export anywhere.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {comingSoonDefs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No additional integrations available.</p>
          ) : (
            comingSoonDefs.map((def) => {
              const Icon = connectorIcons[def.id] || Building2;
              const saved = savedConnectors.find((c) => c.connectorId === def.id);
              return (
                <div
                  key={def.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-4",
                    saved?.isActive
                      ? "border-emerald-200 bg-emerald-50/50"
                      : "border-border bg-background opacity-60",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{def.name}</p>
                      <p className="text-xs text-muted-foreground">{def.description}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-600">
                    <ExternalLink className="h-3 w-3" />
                    Coming soon
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
