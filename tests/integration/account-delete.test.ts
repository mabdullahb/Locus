import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { hash } from "bcryptjs";

// DELETE /api/account had no test. BusinessLead -> ScrapeSession has no
// onDelete: Cascade, so deleting the user alone fails for anyone who has run
// a search (confirmed against the real database on 2026-11-27: a raw user
// delete was rejected by BusinessLead_sessionId_fkey). The route has to
// delete logs, leads and sessions first, in one transaction. Verified live
// the same day: an account with 1 session, 2 leads and 1 enrichment log was
// fully removed.
vi.mock("@/lib/auth-helpers", () => ({
  requireUserId: vi.fn().mockResolvedValue("user-1"),
  unauthorized: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
}));

// vi.mock factories are hoisted above top-level declarations, so the
// shared call log has to be created inside vi.hoisted.
const { calls } = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), delete: vi.fn((a: unknown) => { calls.push("user.delete"); return a; }) },
    enrichmentLog: { deleteMany: vi.fn((a: unknown) => { calls.push("enrichmentLog"); return a; }) },
    businessLead: { deleteMany: vi.fn((a: unknown) => { calls.push("businessLead"); return a; }) },
    proxySession: { deleteMany: vi.fn((a: unknown) => { calls.push("proxySession"); return a; }) },
    exportHistory: { deleteMany: vi.fn((a: unknown) => { calls.push("exportHistory"); return a; }) },
    scrapeSession: { deleteMany: vi.fn((a: unknown) => { calls.push("scrapeSession"); return a; }) },
    userApiKey: { deleteMany: vi.fn((a: unknown) => { calls.push("userApiKey"); return a; }) },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}));
import { prisma } from "@/lib/db";
import { DELETE } from "@/app/api/account/route";

const findUser = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const tx = prisma.$transaction as ReturnType<typeof vi.fn>;

function del(body: unknown) {
  return DELETE(new NextRequest("http://localhost/api/account", { method: "DELETE", body: JSON.stringify(body) }));
}

describe("DELETE /api/account", () => {
  beforeEach(async () => {
    calls.length = 0;
    vi.clearAllMocks();
    tx.mockResolvedValue([]);
    findUser.mockResolvedValue({ email: "owner@example.com", password: await hash("RightPassword1!", 4) });
  });

  it("deletes logs, leads and sessions before the user, in one transaction", async () => {
    const res = await del({ confirmEmail: "Owner@Example.com ", password: "RightPassword1!" });
    expect(res.status).toBe(200);
    expect(tx).toHaveBeenCalledTimes(1);
    expect(calls.indexOf("enrichmentLog")).toBeLessThan(calls.indexOf("businessLead"));
    expect(calls.indexOf("businessLead")).toBeLessThan(calls.indexOf("scrapeSession"));
    expect(calls.indexOf("proxySession")).toBeLessThan(calls.indexOf("scrapeSession"));
    expect(calls.indexOf("scrapeSession")).toBeLessThan(calls.indexOf("user.delete"));
    expect(calls.at(-1)).toBe("user.delete");
    expect(prisma.businessLead.deleteMany).toHaveBeenCalledWith({ where: { session: { userId: "user-1" } } });
  });

  it("refuses when the typed email doesn't match", async () => {
    const res = await del({ confirmEmail: "someone@else.com", password: "RightPassword1!" });
    expect(res.status).toBe(400);
    expect(tx).not.toHaveBeenCalled();
  });

  it("refuses a wrong password", async () => {
    const res = await del({ confirmEmail: "owner@example.com", password: "WrongPassword1!" });
    expect(res.status).toBe(400);
    expect(tx).not.toHaveBeenCalled();
  });

  it("reports a failure instead of half-deleting when the transaction fails", async () => {
    tx.mockRejectedValueOnce(new Error("BusinessLead_sessionId_fkey"));
    const res = await del({ confirmEmail: "owner@example.com", password: "RightPassword1!" });
    expect(res.status).toBe(500);
  });
});
