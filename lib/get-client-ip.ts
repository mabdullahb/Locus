// X-Forwarded-For is a plain client-supplied header. Trusting it blindly for
// rate-limiting lets anyone bypass every IP-keyed limit (login, register,
// forgot-password) just by sending a different fake value on each request,
// unless something in front of this app (a reverse proxy, load balancer, or
// platform edge) strips whatever the client sent and replaces it with the
// real one. That's true on Vercel, but not guaranteed for a self-hosted
// Docker deployment with no reverse proxy configured.
//
// TRUST_PROXY_HEADERS opts in explicitly: set it to "true" only when this
// app sits behind something that overwrites X-Forwarded-For before it
// reaches Node. When unset (the safe default), every request is bucketed
// under "unknown", so the rate limit is still enforced, just globally
// instead of per real attacker IP, rather than being trivially bypassable.
const TRUST_PROXY_HEADERS = process.env.TRUST_PROXY_HEADERS === "true";

export function getClientIp(headers: Headers): string {
  if (!TRUST_PROXY_HEADERS) return "unknown";
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
