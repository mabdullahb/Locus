const API_KEY_PATTERNS = [
  // Tolerates a space after "key:"/"key=" — most real provider error bodies
  // format it that way ("Invalid API key. Your api_key: xyz is not valid").
  /(?:(?:api[_-]?key|apikey|secret|token|password|auth)[=:]\s*["']?)([^&"' \n<>{}\\]{8,})/gi,
  /AIza[0-9A-Za-z_-]{35,}/g,
  /sk-ant-[0-9A-Za-z-]{32,}/g,
  /sk-[0-9A-Za-z-]{32,}/g,
];

export function sanitizeLog(message: string): string {
  if (!message) return message;
  return API_KEY_PATTERNS.reduce((acc, pattern) => {
    return acc.replace(pattern, (...args: unknown[]) => {
      const match = args[0] as string;
      // replace()'s callback signature is (match, p1, p2, ..., offset, string) —
      // args[1] is only a real capture group when the pattern actually has
      // one; for patterns with none (AIza/sk-/sk-ant-) it's the numeric
      // match offset instead. Treating that offset as truthy was the bug:
      // match.replace(28, "***") silently no-ops since "28" isn't a
      // substring of the key, so the key passed through completely unredacted.
      const group = typeof args[1] === "string" ? args[1] : undefined;
      if (group) {
        return match.replace(group, "*".repeat(Math.min(group.length, 16)));
      }
      // No capture group to isolate — redact the whole match. A trailing-
      // characters-only mask would still leave most of a real key readable.
      return "*".repeat(Math.min(match.length, 24));
    });
  }, message);
}
