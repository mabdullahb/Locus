import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth-helpers", () => ({
  requireUserId: vi.fn(),
  unauthorized: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    scrapeSession: { findUnique: vi.fn(), delete: vi.fn() },
    businessLead: { deleteMany: vi.fn() },
    enrichmentLog: { deleteMany: vi.fn() },
    exportHistory: { deleteMany: vi.fn() },
    proxySession: { deleteMany: vi.fn() },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}));

import { requireUserId } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { DELETE } from "@/app/api/history/[id]/route";

const findUnique = prisma.scrapeSession.findUnique as ReturnType<typeof vi.fn>;
const tx = prisma.$transaction as ReturnType<typeof vi.fn>;

function del(id: string) {
  return DELETE(new NextRequest(`http://localhost/api/history/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

describe("DELETE /api/history/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-1");
  });

  it("401s when not authenticated", async () => {
    (requireUserId as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Unauthorized"));
    expect((await del("s1")).status).toBe(401);
  });

  it("404s for a session the user does not own", async () => {
    findUnique.mockResolvedValue({ userId: "someone-else" });
    const res = await del("s1");
    expect(res.status).toBe(404);
    expect(tx).not.toHaveBeenCalled();
  });

  it("404s for a missing session", async () => {
    findUnique.mockResolvedValue(null);
    expect((await del("s1")).status).toBe(404);
    expect(tx).not.toHaveBeenCalled();
  });

  it("deletes dependent rows then the session, in one transaction", async () => {
    findUnique.mockResolvedValue({ userId: "user-1" });
    const res = await del("s1");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(tx).toHaveBeenCalledOnce();
    expect(prisma.enrichmentLog.deleteMany).toHaveBeenCalledWith({ where: { lead: { sessionId: "s1" } } });
    expect(prisma.businessLead.deleteMany).toHaveBeenCalledWith({ where: { sessionId: "s1" } });
    expect(prisma.scrapeSession.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });
});
