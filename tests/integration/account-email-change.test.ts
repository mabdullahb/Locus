import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth-helpers", () => ({
  requireUserId: vi.fn(),
  unauthorized: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
}));
vi.mock("bcryptjs", () => ({ compare: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { requireUserId } from "@/lib/auth-helpers";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { PATCH } from "@/app/api/account/route";

const findUser = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const updateUser = prisma.user.update as ReturnType<typeof vi.fn>;
const bcryptCompare = compare as ReturnType<typeof vi.fn>;

function patch(body: unknown) {
  return PATCH(
    new NextRequest("http://localhost/api/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("PATCH /api/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-1");
    findUser.mockResolvedValue({ email: "old@example.com", password: "existing-hash" });
    updateUser.mockResolvedValue({ id: "user-1", name: "Name", email: "new@example.com" });
  });

  it("changes name with no password required, since it is not security-sensitive", async () => {
    const res = await patch({ name: "New Name" });
    expect(res.status).toBe(200);
    expect(bcryptCompare).not.toHaveBeenCalled();
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "New Name" },
      select: { id: true, name: true, email: true },
    });
  });

  it("rejects an email change with no current password", async () => {
    const res = await patch({ email: "new@example.com" });
    expect(res.status).toBe(400);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects an email change when the current password is wrong", async () => {
    bcryptCompare.mockResolvedValue(false);
    const res = await patch({ email: "new@example.com", currentPassword: "wrong" });
    expect(res.status).toBe(400);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("allows an email change with the correct current password", async () => {
    bcryptCompare.mockResolvedValue(true);
    const res = await patch({ email: "new@example.com", currentPassword: "right" });
    expect(res.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { email: "new@example.com" },
      select: { id: true, name: true, email: true },
    });
  });

  it("does not require a password when the email is resubmitted unchanged", async () => {
    const res = await patch({ name: "New Name", email: "old@example.com" });
    expect(res.status).toBe(200);
    expect(bcryptCompare).not.toHaveBeenCalled();
  });

  it("stores the new email lowercased, matching the canonical form login and register use", async () => {
    bcryptCompare.mockResolvedValue(true);
    const res = await patch({ email: "New@Example.com", currentPassword: "right" });
    expect(res.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { email: "new@example.com" },
      select: { id: true, name: true, email: true },
    });
  });

  it("treats a re-cased resubmission of the same email as unchanged, no password required", async () => {
    const res = await patch({ email: "OLD@EXAMPLE.com" });
    expect(res.status).toBe(200);
    expect(bcryptCompare).not.toHaveBeenCalled();
  });
});
