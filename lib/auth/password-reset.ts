import { randomBytes, createHash } from "crypto";

// The raw token goes in the email link. Only its SHA-256 hash is stored, so a
// leak of the PasswordResetToken table does not hand out usable reset links.
const TOKEN_BYTES = 32;

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // one hour

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  return { token, tokenHash: hashResetToken(token) };
}

export function resetTokenExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + RESET_TOKEN_TTL_MS);
}
