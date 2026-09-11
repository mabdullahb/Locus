import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Regression: saving a webhook URL only ran `new URL()` validation. An
// internal/blocked target (localhost, a private IP, cloud metadata) saved
// successfully and showed as "Configured" in Settings > Integrations, with
// no indication it would always fail the SSRF check that already existed at
// actual delivery time (lib/export/connectors/webhook.ts). Confirmed live: a
// real saved config of "http://localhost:4599/" sat as "Configured"
// indefinitely. The save path must reject it too, not only the send path.
//
// assertOutboundUrlAllowed's own resolution logic is covered by
// tests/unit/ssrf-guard.test.ts. Mocked here so this test stays about the
// route's behavior, not a real DNS lookup.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    webhookConfig: { upsert: vi.fn() },
    connectorConfig: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/security/ssrf-guard", () => ({
  assertOutboundUrlAllowed: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertOutboundUrlAllowed } from "@/lib/security/ssrf-guard";
import { POST } from "@/app/api/settings/connectors/route";

describe("POST /api/settings/connectors webhook SSRF validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
    });
  });

  it("rejects a webhook URL the SSRF guard blocks, instead of silently saving it", async () => {
    (assertOutboundUrlAllowed as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("URL resolves to a non-public address"),
    );

    const req = new NextRequest("http://localhost/api/settings/connectors", {
      method: "POST",
      body: JSON.stringify({ type: "webhook", config: { webhookUrl: "http://localhost:4599/" } }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("URL resolves to a non-public address");
    expect(prisma.webhookConfig.upsert).not.toHaveBeenCalled();
  });

  it("still accepts a webhook URL the SSRF guard allows", async () => {
    (assertOutboundUrlAllowed as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (prisma.webhookConfig.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      webhookUrl: "https://hooks.example.com/endpoint",
      isActive: true,
    });

    const req = new NextRequest("http://localhost/api/settings/connectors", {
      method: "POST",
      body: JSON.stringify({ type: "webhook", config: { webhookUrl: "https://hooks.example.com/endpoint" } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prisma.webhookConfig.upsert).toHaveBeenCalled();
  });
});
