import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    passwordResetToken: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue({ ok: true }),
}));

import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { POST } from "@/app/api/auth/forgot-password/route";

const findUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const createToken = prisma.passwordResetToken.create as ReturnType<typeof vi.fn>;
const sendEmail = sendPasswordResetEmail as ReturnType<typeof vi.fn>;

function post(body: unknown, ip = "1.2.3.4") {
  return POST(
    new NextRequest("http://localhost/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("400s when no email is given", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
  });

  it("returns ok without creating a token or sending mail for an unknown email", async () => {
    findUnique.mockResolvedValue(null);
    const res = await post({ email: "nobody@example.com" }, "10.0.0.1");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(createToken).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("creates a token and emails a link for a known email", async () => {
    findUnique.mockResolvedValue({ id: "user-1", email: "known@example.com" });
    const res = await post({ email: "known@example.com" }, "10.0.0.2");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", usedAt: null },
    });
    expect(createToken).toHaveBeenCalledOnce();
    const [to, link] = sendEmail.mock.calls[0];
    expect(to).toBe("known@example.com");
    expect(link).toMatch(/\/reset-password\?token=[0-9a-f]{64}$/);
  });

  it("429s after too many requests for the same email", async () => {
    findUnique.mockResolvedValue({ id: "user-1", email: "spam@example.com" });
    let last;
    for (let i = 0; i < 7; i++) {
      last = await post({ email: "spam@example.com" }, `10.0.1.${i}`);
    }
    expect(last!.status).toBe(429);
  });
});
