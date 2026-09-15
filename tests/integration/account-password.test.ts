import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth-helpers", () => ({
  requireUserId: vi.fn(),
  unauthorized: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("bcryptjs", () => ({
  compare: vi.fn(),
  hash: vi.fn().mockResolvedValue("hashed-new-password"),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    userSession: { updateMany: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

import { requireUserId } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/account/password/route";

const findUser = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const revokeSessions = prisma.userSession.updateMany as ReturnType<typeof vi.fn>;
const bcryptCompare = compare as ReturnType<typeof vi.fn>;

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/account/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/account/password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-1");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ sessionId: "current-session" });
    findUser.mockResolvedValue({ password: "existing-hash" });
  });

  it("revokes every other device session but keeps the current one", async () => {
    bcryptCompare.mockResolvedValue(true);

    const res = await post({ currentPassword: "old-pass", newPassword: "brand-new-pass" });
    expect(res.status).toBe(200);

    expect(revokeSessions).toHaveBeenCalledWith({
      where: { userId: "user-1", revoked: false, id: { not: "current-session" } },
      data: { revoked: true },
    });
  });

  it("does not revoke any session when the current password is wrong", async () => {
    bcryptCompare.mockResolvedValue(false);

    const res = await post({ currentPassword: "wrong", newPassword: "brand-new-pass" });
    expect(res.status).toBe(400);
    expect(revokeSessions).not.toHaveBeenCalled();
  });

  it("still revokes other sessions when the session callback yields no sessionId (pre-feature sessions)", async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({});
    bcryptCompare.mockResolvedValue(true);

    await post({ currentPassword: "old-pass", newPassword: "brand-new-pass" });

    expect(revokeSessions).toHaveBeenCalledWith({
      where: { userId: "user-1", revoked: false },
      data: { revoked: true },
    });
  });
});
