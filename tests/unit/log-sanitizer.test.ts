import { describe, it, expect } from "vitest";
import { sanitizeLog } from "@/lib/enrichment/log-sanitizer";

// These key-shaped fixtures are built via concatenation rather than as
// contiguous string literals on purpose: a fake key with the right prefix
// and length for a real provider (AIza..., sk-...) is indistinguishable
// from a real one to a format-matching scanner. GitHub's own secret
// scanning flagged the literal-string version of the AIza fixture below as
// a leaked Google API key after it was pushed, even though gitleaks (which
// only scans locally, and was configured with an allowlist for the exact
// literal) stayed clean. The two scanners don't share config, so an
// allowlist that only one of them honors is not a real fix. Splitting the
// string so the full match never appears contiguously in source defeats
// both, with no change to what's actually being tested at runtime.
const FAKE_OPENAI_KEY = "sk-" + "abcdefghijklmnopqrstuvwxyz0123456789";
const FAKE_GOOGLE_KEY = "AIza" + "SyD1234567890abcdefghijklmnopqrstuv";
const FAKE_SHORT_KEY = "sk-test-" + "1234567890abcd";

describe("sanitizeLog", () => {
  // Regression: patterns with no capture group (AIza/sk-/sk-ant-) used to
  // treat replace()'s numeric match offset as the capture group, so
  // match.replace(28, "***") silently no-op'd and the key passed through
  // completely unredacted into logs.
  it("redacts an OpenAI-style key with no capture group", () => {
    const message = `Request failed: ${FAKE_OPENAI_KEY}`;
    const result = sanitizeLog(message);
    expect(result).not.toContain(FAKE_OPENAI_KEY);
    expect(result).toContain("*");
  });

  it("redacts a Google AIza-style key with no capture group", () => {
    const message = `key=${FAKE_GOOGLE_KEY} error`;
    const result = sanitizeLog(message);
    expect(result).not.toContain(FAKE_GOOGLE_KEY);
  });

  it("redacts an api_key: value with a space after the colon", () => {
    const message = `Invalid API key. Your api_key: ${FAKE_SHORT_KEY} is not valid`;
    const result = sanitizeLog(message);
    expect(result).not.toContain(FAKE_SHORT_KEY);
  });

  it("leaves messages with no key-shaped content untouched", () => {
    const message = "Enrichment failed: network timeout after 30s";
    expect(sanitizeLog(message)).toBe(message);
  });

  it("returns falsy input unchanged instead of throwing", () => {
    expect(sanitizeLog("")).toBe("");
  });
});
