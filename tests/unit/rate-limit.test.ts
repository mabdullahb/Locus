import { describe, it, expect, vi, afterEach } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

// Each test uses a unique key — the module keeps a shared in-memory bucket
// map, so reusing a key across tests would leak state between them.
let keyCounter = 0;
const uniqueKey = () => `test-key-${++keyCounter}`;

describe("checkRateLimit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit", () => {
    const key = uniqueKey();
    const config = { limit: 3, windowMs: 60_000 };
    expect(checkRateLimit(key, config)).toBe(true);
    expect(checkRateLimit(key, config)).toBe(true);
    expect(checkRateLimit(key, config)).toBe(true);
  });

  it("blocks requests beyond the limit within the same window", () => {
    const key = uniqueKey();
    const config = { limit: 2, windowMs: 60_000 };
    expect(checkRateLimit(key, config)).toBe(true);
    expect(checkRateLimit(key, config)).toBe(true);
    expect(checkRateLimit(key, config)).toBe(false);
  });

  it("resets the count once the window has elapsed", () => {
    vi.useFakeTimers();
    const key = uniqueKey();
    const config = { limit: 1, windowMs: 1000 };
    expect(checkRateLimit(key, config)).toBe(true);
    expect(checkRateLimit(key, config)).toBe(false);

    vi.advanceTimersByTime(1001);

    expect(checkRateLimit(key, config)).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const keyA = uniqueKey();
    const keyB = uniqueKey();
    const config = { limit: 1, windowMs: 60_000 };
    expect(checkRateLimit(keyA, config)).toBe(true);
    expect(checkRateLimit(keyA, config)).toBe(false);
    // A different key should be unaffected by keyA's exhausted limit.
    expect(checkRateLimit(keyB, config)).toBe(true);
  });
});
