"use client";

interface AdvancedConfig {
  concurrency: number;
  proxyType: string;
  enrichmentDepth: string;
  maxResults: number;
  locale: string;
  renderDelay: number;
}

interface AdvancedPanelProps {
  config: AdvancedConfig;
  onChange: (config: AdvancedConfig) => void;
}

export function AdvancedPanel({ config, onChange }: AdvancedPanelProps) {
  const update = (key: keyof AdvancedConfig, value: string | number) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Concurrency</label>
          <select
            value={config.concurrency}
            onChange={(e) => update("concurrency", Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value={4}>4 threads (Standard)</option>
            <option value={8}>8 threads (Fast)</option>
            <option value={16}>16 threads (Turbo)</option>
            <option value={32}>32 threads (Enterprise)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Proxy Type</label>
          <select
            value={config.proxyType}
            onChange={(e) => update("proxyType", e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="datacenter">Datacenter</option>
            <option value="residential">Residential</option>
            <option value="premium">Premium Residential</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">AI Enrichment</label>
          <select
            value={config.enrichmentDepth}
            onChange={(e) => update("enrichmentDepth", e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="basic">Basic (name + phone)</option>
            <option value="standard">Standard (+ website)</option>
            <option value="full">Full (+ email enrichment)</option>
            <option value="deep">Deep (+ LinkedIn, social)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Max Results</label>
          <select
            value={config.maxResults}
            onChange={(e) => update("maxResults", Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value={50}>50 leads</option>
            <option value={100}>100 leads</option>
            <option value={250}>250 leads</option>
            <option value={500}>500 leads</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Language/Locale</label>
          <select
            value={config.locale}
            onChange={(e) => update("locale", e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="en-IN">English (India)</option>
            <option value="en-US">English (US)</option>
            <option value="hi-IN">Hindi (India)</option>
            <option value="en-GB">English (UK)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">JS Render Delay</label>
          <select
            value={config.renderDelay}
            onChange={(e) => update("renderDelay", Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value={500}>500ms (Fast)</option>
            <option value={1000}>1s (Standard)</option>
            <option value={2000}>2s (Stealth)</option>
            <option value={5000}>5s (Max Stealth)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
