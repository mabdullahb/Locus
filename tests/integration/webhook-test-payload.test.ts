import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// The "Test" button in Settings > Integrations has no real scrape session to
// point at, so it sends sessionId: "__test__" + testPayload: true. Before
// this fix, the route ignored testPayload and always tried (and failed) to
// look up a session literally named "__test__", so clicking Test always
// 404'd regardless of whether the webhook URL itself was reachable.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    webhookConfig: { findUnique: vi.fn() },
    scrapeSession: { findFirst: vi.fn() },
    businessLead: { findMany: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/export/webhook/route";

describe("POST /api/export/webhook with testPayload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1" },
    });
    (prisma.webhookConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      webhookUrl: "https://example.com/hook",
      secret: null,
      isActive: true,
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    }) as unknown as typeof fetch;
  });

  it("delivers a synthetic payload instead of 404ing on the placeholder sessionId", async () => {
    const req = new NextRequest("http://localhost/api/export/webhook", {
      method: "POST",
      body: JSON.stringify({ sessionId: "__test__", testPayload: true }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.scrapeSession.findFirst).not.toHaveBeenCalled();

    const sentBody = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
    );
    expect(sentBody.data[0].businessName).toBe("Test Business");
    expect(sentBody.sessionId).toBeUndefined();
  });
});
