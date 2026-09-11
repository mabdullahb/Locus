import { describe, it, expect } from "vitest";
import { isRateLimitError, describeEnrichmentError } from "@/lib/enrichment/errors";

describe("describeEnrichmentError", () => {
  // Regression: Node's native fetch() wraps a real connection-level failure
  // (DNS, connection refused, reset, TLS) in a generic "fetch failed"
  // TypeError, with the actual reason only on err.cause. Three separate
  // catch blocks each used to log only err.message, throwing that real
  // reason away and leaving "fetch failed" as the only visible clue with
  // no way to tell a DNS failure from a timeout from a reset connection.
  it("appends the cause's message when the error has an Error cause", () => {
    const cause = new Error("ECONNREFUSED 127.0.0.1:443");
    const err = new TypeError("fetch failed", { cause });
    expect(describeEnrichmentError(err)).toBe("fetch failed (cause: ECONNREFUSED 127.0.0.1:443)");
  });

  it("appends a non-Error cause by stringifying it", () => {
    const err = new Error("fetch failed", { cause: "ETIMEDOUT" });
    expect(describeEnrichmentError(err)).toBe("fetch failed (cause: ETIMEDOUT)");
  });

  it("returns just the message, unchanged, when there is no cause", () => {
    const err = new Error("Serper search failed (429): rate limited");
    expect(describeEnrichmentError(err)).toBe("Serper search failed (429): rate limited");
  });

  it("falls back to String(err) for a thrown value that isn't an Error at all", () => {
    expect(describeEnrichmentError("a raw string throw")).toBe("a raw string throw");
  });

  it("handles undefined/null thrown values without crashing", () => {
    expect(describeEnrichmentError(undefined)).toBe("undefined");
    expect(describeEnrichmentError(null)).toBe("null");
  });
});

describe("isRateLimitError", () => {
  it("still recognizes rate-limit-shaped messages (unaffected by the cause change)", () => {
    expect(isRateLimitError("429 Too Many Requests")).toBe(true);
    expect(isRateLimitError("RESOURCE_EXHAUSTED")).toBe(true);
  });

  it("does not misclassify a cause-appended network error as a rate limit", () => {
    expect(isRateLimitError("fetch failed (cause: ECONNREFUSED)")).toBe(false);
  });
});
