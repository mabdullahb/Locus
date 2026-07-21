const API_KEY_PATTERNS = [
  /(?:(?:api[_-]?key|apikey|secret|token|password|auth)[=:]["']?)([^&"' \n<>{}\\]{8,})/gi,
  /AIza[0-9A-Za-z_-]{35,}/g,
  /sk-[0-9A-Za-z]{32,}/g,
  /sk-ant-[0-9A-Za-z]{32,}/g,
];

export function sanitizeLog(message: string): string {
  if (!message) return message;
  return API_KEY_PATTERNS.reduce((acc, pattern) => {
    return acc.replace(pattern, (match, group) => {
      if (group) {
        return match.replace(
          group,
          "*".repeat(Math.min(group.length, 16)),
        );
      }
      return match.slice(0, -16) + "*".repeat(16);
    });
  }, message);
}
