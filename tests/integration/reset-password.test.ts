import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { compare } from "bcryptjs";
import { hashResetToken } from "@/lib/auth/password-reset";

vi.mock("@/lib/db", () => ({
  prisma: {
    passwordResetToken: { findUnique: vi.fn(), update: vi.fn() },
    user: { update: vi.fn() },
    userSession: { updateMany: vi.fn() },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}));

import { prisma } from "@/lib/db";
import { POST } from "@/app/api/auth/reset-password/route";

const findToken = prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>;
const userUpdate = prisma.user.update as ReturnType<typeof vi.fn>;
const revokeSessions = prisma.userSession.updateMany as ReturnType<typeof vi.fn>;

function post(body: unknown, ip = "9.9.9.9") {
  return POST(
    new NextRequest("http://localhost/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}

const future = () => new Date(Date.now() + 60 * 60 * 1000);
const past = () => new Date(Date.now() - 60 * 1000);

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("400s when token or password is missing", async () => {
    expect((await post({ password: "longenough" })).status).toBe(400);
    expect((await post({ token: "abc" })).status).toBe(400);
  });

  it("400s on a password shorter than 8 characters", async () => {
    const res = await post({ token: "abc", password: "short" });
    expect(res.status).toBe(400);
    expect(findToken).not.toHaveBeenCalled();
  });

  it("400s when the token is unknown", async () => {
    findToken.mockResolvedValue(null);
    const res = await post({ token: "deadbeef", password: "a-good-password" }, "9.9.9.1");
    expect(res.status).toBe(400);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("400s when the token is expired", async () => {
    findToken.mockResolvedValue({ id: "t1", userId: "u1", usedAt: null, expiresAt: past() });
    const res = await post({ token: "expired-tok", password: "a-good-password" }, "9.9.9.2");
    expect(res.status).toBe(400);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("400s when the token was already used", async () => {
    findToken.mockResolvedValue({
      id: "t1",
      userId: "u1",
      usedAt: new Date(),
      expiresAt: future(),
    });
    const res = await post({ token: "used-tok", password: "a-good-password" }, "9.9.9.3");
    expect(res.status).toBe(400);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("looks the token up by its hash, not the raw value", async () => {
    findToken.mockResolvedValue({ id: "t1", userId: "u1", usedAt: null, expiresAt: future() });
    await post({ token: "raw-secret-token", password: "a-good-password" }, "9.9.9.4");
    expect(findToken).toHaveBeenCalledWith({
      where: { tokenHash: hashResetToken("raw-secret-token") },
    });
  });

  it("stores a bcrypt hash of the new password, marks the token used, and revokes sessions", async () => {
    findToken.mockResolvedValue({ id: "t1", userId: "u1", usedAt: null, expiresAt: future() });

    const res = await post({ token: "valid-tok", password: "brand-new-pass" }, "9.9.9.5");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });

    const stored = userUpdate.mock.calls[0][0].data.password as string;
    expect(stored).not.toBe("brand-new-pass");
    expect(await compare("brand-new-pass", stored)).toBe(true);

    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { usedAt: expect.any(Date) },
    });
    expect(revokeSessions).toHaveBeenCalledWith({
      where: { userId: "u1", revoked: false },
      data: { revoked: true },
    });
  });
});
