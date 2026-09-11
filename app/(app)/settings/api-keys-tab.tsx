"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Search, Brain, Mail, Trash2, CheckCircle2, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";

const PROVIDER_SECTIONS = [
  {
    key: "business-search",
    label: "Business Search",
    icon: Search,
    description: "Used during extraction to find businesses and their contact details from online directories. Choose one provider.",
    providers: [
      { value: "serpapi", label: "SerpApi" },
      { value: "google_places", label: "Google Maps Places API" },
      { value: "serper", label: "Serper.dev" },
    ],
  },
  {
    key: "ai-enrichment",
    label: "Email Enrichment",
    icon: Brain,
    description: "Used after extraction to find email addresses for each business by scanning websites and search results.",
    providers: [
      { value: "gemini", label: "Gemini (Google)" },
      { value: "anthropic", label: "Claude (Anthropic)" },
      { value: "openai", label: "OpenAI" },
      { value: "openrouter", label: "OpenRouter" },
      // Still under test — server-side gated to admins in /api/settings/ai-key;
      // hiding it here is just a UX nicety, not the actual access control.
      { value: "9router", label: "9Router", adminOnly: true },
    ],
  },
  {
    key: "email-finder",
    label: "Email Finder (optional)",
    icon: Mail,
    description: "Checked before AI extraction runs, since a match here skips fetching and parsing the website entirely. Leave unconfigured and enrichment works exactly as before.",
    providers: [
      { value: "hunter", label: "Hunter.io" },
    ],
  },
];

interface SavedKey {
  id: string;
  provider: string;
  keyPrefix: string;
  model?: string | null;
  createdAt: string;
}

interface OpenRouterModelOption {
  id: string;
  name: string;
  isFree: boolean;
  contextLength: number | null;
}

export function ApiKeysTab() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin ?? false;

  const [keys, setKeys] = useState<SavedKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [provider, setProvider] = useState("serpapi");
  const [apiKey, setApiKey] = useState("");

  const [orModels, setOrModels] = useState<OpenRouterModelOption[]>([]);
  const [orModelsLoading, setOrModelsLoading] = useState(false);
  const [orModelsSource, setOrModelsSource] = useState<"live" | "fallback" | null>(null);
  const [orModelsError, setOrModelsError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("");

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
    queueMicrotask(() => {
      fetchKeys();
    });
  }, []);

  useEffect(() => {
    if (provider !== "openrouter" || orModels.length > 0 || orModelsLoading) return;
    queueMicrotask(() => {
      setOrModelsLoading(true);
      setOrModelsError(null);
    });
    fetch("/api/settings/openrouter-models")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load OpenRouter models");
        return res.json();
      })
      .then((data) => {
        setOrModels(data.models || []);
        setOrModelsSource(data.source || null);
      })
      .catch(() => {
        setOrModelsError("Couldn't reach OpenRouter's live model list. You can still type a model ID below.");
      })
      .finally(() => setOrModelsLoading(false));
  }, [provider, orModels.length, orModelsLoading]);

  // 9Router has no safe default model to fall back to (unlike OpenRouter's
  // free auto-router) — saving a key without one silently created a key that
  // could never actually enrich anything, since the provider throws before
  // making any request. Block it client-side instead of failing later.
  const requiresModel = provider === "9router";
  const modelMissing = requiresModel && !selectedModel.trim();

  const handleSave = async () => {
    if (!apiKey.trim() || modelMissing) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const model = provider === "openrouter" || provider === "9router" ? (selectedModel || undefined) : undefined;

      const res = await fetch("/api/settings/ai-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      setApiKey("");
      setSelectedModel("");
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
    setConfirmingRemove(null);
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
    <div className="space-y-8">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-positive/40 bg-positive/10 px-4 py-3 text-sm text-positive">
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
        <>
          {PROVIDER_SECTIONS.map((section) => {
            const SectionIcon = section.icon;
            return (
              <div key={section.key} className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex items-center gap-3">
                  <SectionIcon className="h-5 w-5 text-primary" />
                  <div>
                    <h2 className="font-display text-lg font-semibold text-foreground">
                      {section.label}
                    </h2>
                    <p className="text-xs text-muted-foreground">{section.description}</p>
                  </div>
                </div>

                {section.key === "business-search" && (
                  <div className="mb-4 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-xs text-primary">
                    <p className="font-medium">New to Locus? Get started for free.</p>
                    <p className="mt-1 text-primary">
                      Locus is bring-your-own-key — we don&apos;t provide search credits ourselves — but both
                      providers below offer their own free way to get started at no cost:
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      <li className="flex items-start gap-1.5">
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>
                          <a
                            href="https://serpapi.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium underline hover:text-primary"
                          >
                            SerpApi (serpapi.com)
                          </a>{" "}
                          — offers a free trial for new accounts (check their site for current terms)
                        </span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>
                          <a
                            href="https://serper.dev"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium underline hover:text-primary"
                          >
                            Serper.dev (serper.dev)
                          </a>{" "}
                          — offers 2,500 free searches for new accounts (check their site for current terms)
                        </span>
                      </li>
                    </ul>
                    <p className="mt-2 text-primary">
                      Sign up with either one, paste the key below, and you can start extracting right away.
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {section.providers.filter((p) => isAdmin || !p.adminOnly).map((p) => {
                    const saved = getSavedKey(p.value);
                    return (
                      <div
                        key={p.value}
                        className="flex items-center justify-between rounded-lg border border-border bg-background p-4"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {p.label}
                            {saved?.model && (
                              <span className="font-mono font-normal text-muted-foreground"> ({saved.model})</span>
                            )}
                          </p>
                          {saved ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Key: {saved.keyPrefix}...
                            </p>
                          ) : (
                            <p className="mt-0.5 text-xs text-destructive">Not configured</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {saved ? (
                            confirmingRemove === p.value ? (
                              <span className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Remove this key?</span>
                                <button
                                  onClick={() => handleRemove(p.value)}
                                  disabled={removing === p.value}
                                  className="flex items-center gap-1 rounded-md bg-destructive-solid px-2.5 py-1 font-medium text-destructive-foreground hover:bg-destructive-solid/90 disabled:opacity-50"
                                >
                                  {removing === p.value ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmingRemove(null)}
                                  disabled={removing === p.value}
                                  className="rounded-md border border-input px-2.5 py-1 font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmingRemove(p.value)}
                                className="flex items-center gap-1 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3 w-3" />
                                Remove
                              </button>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-3 text-sm font-medium text-foreground">
              Add or replace API key
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Select a provider from any section above and enter your API key.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px]">
                <label htmlFor="provider-select" className="mb-1 block text-xs text-muted-foreground">Provider</label>
                <select
                  id="provider-select"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <optgroup label="Business Search">
                    <option value="serpapi">SerpApi</option>
                    <option value="google_places">Google Maps Places API</option>
                    <option value="serper">Serper.dev</option>
                  </optgroup>
                  <optgroup label="Email Enrichment">
                    <option value="gemini">Gemini (Google)</option>
                    <option value="anthropic">Claude (Anthropic)</option>
                    <option value="openai">OpenAI</option>
                    <option value="openrouter">OpenRouter</option>
                    {isAdmin && <option value="9router">9Router</option>}
                  </optgroup>
                  <optgroup label="Email Finder (optional)">
                    <option value="hunter">Hunter.io</option>
                  </optgroup>
                </select>
              </div>
              <div className="min-w-[240px] flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">API Key</label>
                <PasswordInput
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !apiKey.trim() || modelMissing}
                title={modelMissing ? "Enter a model or Combo name below first" : undefined}
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

            {provider === "openrouter" && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <div className="min-w-[280px] max-w-md">
                  <label htmlFor="openrouter-model-select" className="mb-1 block text-xs text-muted-foreground">
                    Model {orModelsLoading && "(loading...)"}
                  </label>
                  <select
                    id="openrouter-model-select"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={orModelsLoading}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                  >
                    <option value="">Use default (OpenRouter auto-router, free)</option>
                    {orModels.some((m) => m.isFree) && (
                      <optgroup label="Free">
                        {orModels.filter((m) => m.isFree).map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {orModels.some((m) => !m.isFree) && (
                      <optgroup label="Paid">
                        {orModels.filter((m) => !m.isFree).map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">
                  {orModelsError
                    ? orModelsError
                    : orModelsSource === "fallback"
                      ? "Showing a curated list — OpenRouter's live catalog couldn't be reached."
                      : "Live list from OpenRouter — pick any model they support."}
                </p>
              </div>
            )}

            {provider === "9router" && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <div className="min-w-[280px] max-w-md">
                  <label htmlFor="9router-model-input" className="mb-1 block text-xs text-muted-foreground">
                    Model or Combo name (required)
                  </label>
                  <input
                    id="9router-model-input"
                    type="text"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    placeholder="e.g. locus"
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm font-mono text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                {modelMissing && apiKey.trim() && (
                  <p className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    Required — 9Router has no default model to fall back to. Save is disabled until this is filled in.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  9Router is self-hosted — there&apos;s no shared model catalog to pick from.
                  Enter an exact model ID, or the name of a 9Router Combo (a group of
                  models with a fallback strategy configured on the router itself —
                  Locus just sends the Combo name as the model).
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
