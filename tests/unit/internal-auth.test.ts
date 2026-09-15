import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  verifyInternalSecret,
  internalSecretHeaders,
  getInternalSecret,
} from "@/lib/internal-auth";

const original = process.env.INTERNAL_API_SECRET;

describe("internal-auth", () => {
  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = "s3cr3t-value";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.INTERNAL_API_SECRET;
    else process.env.INTERNAL_API_SECRET = original;
  });

  it("accepts the exact secret", () => {
    expect(verifyInternalSecret("s3cr3t-value")).toBe(true);
  });

  it("rejects a wrong, empty, or missing value", () => {
    expect(verifyInternalSecret("wrong")).toBe(false);
    expect(verifyInternalSecret("")).toBe(false);
    expect(verifyInternalSecret(null)).toBe(false);
    expect(verifyInternalSecret(undefined)).toBe(false);
  });

  it("rejects a value that shares a prefix but differs in length", () => {
    expect(verifyInternalSecret("s3cr3t-value-extra")).toBe(false);
    expect(verifyInternalSecret("s3cr3t")).toBe(false);
  });

  it("fails closed when no secret is configured", () => {
    delete process.env.INTERNAL_API_SECRET;
    expect(getInternalSecret()).toBeNull();
    expect(verifyInternalSecret("anything")).toBe(false);
    expect(internalSecretHeaders()).toEqual({});
  });

  it("emits the header only when a secret is set", () => {
    expect(internalSecretHeaders()).toEqual({ "x-internal-secret": "s3cr3t-value" });
  });
});
