import { describe, it, expect } from "vitest";
import {
  generateResetToken,
  hashResetToken,
  resetTokenExpiry,
  RESET_TOKEN_TTL_MS,
} from "@/lib/auth/password-reset";

describe("password-reset token helpers", () => {
  it("generates a 64-char hex token with a matching sha-256 hash", () => {
    const { token, tokenHash } = generateResetToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashResetToken(token));
  });

  it("never returns the same token twice", () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it("hashes deterministically and does not leak the raw token", () => {
    const hash = hashResetToken("abc123");
    expect(hashResetToken("abc123")).toBe(hash);
    expect(hash).not.toContain("abc123");
  });

  it("sets expiry one hour ahead of the given time", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    expect(resetTokenExpiry(from).getTime()).toBe(from.getTime() + RESET_TOKEN_TTL_MS);
    expect(RESET_TOKEN_TTL_MS).toBe(60 * 60 * 1000);
  });
});
