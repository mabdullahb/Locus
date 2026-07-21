"use client";

import { useState, useEffect } from "react";
import { Key, Trash2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const PROVIDERS = [
  { value: "gemini", label: "Gemini (Google)" },
  { value: "anthropic", label: "Claude (Anthropic)" },
  { value: "openai", label: "OpenAI" },
] as const;

interface SavedKey {
  id: string;
  provider: string;
  keyPrefix: string;
  createdAt: string;
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<SavedKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [provider, setProvider] = useState("gemini");
  const [apiKey, setApiKey] = useState("");

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/ai-key");
      const data = await res.json();
      setKeys(data.keys || []);
    } catch {
      setError("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/settings/ai-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      setApiKey("");
      setSuccess(`API key for ${provider} saved`);
      await fetchKeys();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (prov: string) => {
    setRemoving(prov);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/settings/ai-key?provider=${prov}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove");
      setSuccess(`API key for ${prov} removed`);
      await fetchKeys();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRemoving(null);
    }
  };

  const getSavedKey = (prov: string) => keys.find((k) => k.provider === prov);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and integrations.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-3">
          <Key className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-foreground">
            AI Provider
          </h2>
        </div>

        <p className="mb-5 text-sm text-muted-foreground">
          Choose your LLM provider and enter your API key. The key is encrypted at
          rest and never exposed to the frontend. Used for AI-powered lead enrichment.
        </p>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {success}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading saved keys...
          </div>
        ) : (
          <div className="space-y-4">
            {PROVIDERS.map((p) => {
              const saved = getSavedKey(p.value);
              return (
                <div
                  key={p.value}
                  className="flex items-center justify-between rounded-lg border border-border bg-background p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.label}</p>
                    {saved ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Key: {saved.keyPrefix}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted-foreground">No key saved</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {saved ? (
                      <button
                        onClick={() => handleRemove(p.value)}
                        disabled={removing === p.value}
                        className="flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {removing === p.value ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        Remove
                      </button>
                    ) : (
                      <span className="text-xs text-red-400">Not configured</span>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="mt-6 border-t border-border pt-5">
              <h3 className="mb-3 text-sm font-medium text-foreground">
                Add or replace API key
              </h3>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[160px]">
                  <label className="mb-1 block text-xs text-muted-foreground">Provider</label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[240px] flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || !apiKey.trim()}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Save Key
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
