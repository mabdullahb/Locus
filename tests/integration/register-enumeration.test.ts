import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Regression: registering with an already-used email used to return a
// distinct 409 with "Email already registered", letting anyone probe this
// endpoint to enumerate which emails have accounts on the platform. The
// response for an existing email must now be indistinguishable in shape and
// status from a genuine new signup, and must not touch the existing row.
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("hashed"),
}));

import { prisma } from "@/lib/db";
import { hash } from "bcryptjs";
import { POST } from "@/app/api/register/route";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/register enumeration resistance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the same 200 status for an already-registered email as a genuine signup", async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing-user-1",
      email: "taken@example.com",
      password: "real-hash",
    });

    const res = await POST(
      makeRequest({ name: "Attacker", email: "taken@example.com", password: "guessedpassword" }),
    );

    expect(res.status).toBe(200);
    expect(prisma.user.create).not.toHaveBeenCalled();
    // Still pays the bcrypt cost, so response timing doesn't leak existence.
    expect(hash).toHaveBeenCalledWith("guessedpassword", 12);
  });

  it("still creates a real account and returns 200 for a genuinely new email", async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "new-user-1",
      email: "fresh@example.com",
      name: "Fresh",
    });

    const res = await POST(
      makeRequest({ name: "Fresh", email: "fresh@example.com", password: "realpassword" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(body.id).toBe("new-user-1");
  });
});
