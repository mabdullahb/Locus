import dns from "dns";
import net from "net";

// Rejects outbound URLs that resolve to loopback, private, link-local, or
// otherwise non-public addresses. A user-supplied webhook or connector URL
// with no such check can be pointed at cloud metadata (169.254.169.254),
// localhost, or internal services, which is server-side request forgery.
//
// Residual risk: a hostname could pass this check and then resolve to a
// private address on the fetch that follows (DNS rebinding). Closing that
// fully needs pinning the connection to the address validated here. Callers
// should also disable redirect following so a 3xx to an internal target
// cannot bypass the check.

function ipv4ToInt(ip: string): number {
  const p = ip.split(".").map(Number);
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

function inCidr(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return ((ipv4ToInt(ip) & mask) >>> 0) === ((ipv4ToInt(base) & mask) >>> 0);
}

function isPrivateIpv4(ip: string): boolean {
  return (
    inCidr(ip, "0.0.0.0", 8) ||
    inCidr(ip, "10.0.0.0", 8) ||
    inCidr(ip, "100.64.0.0", 10) ||
    inCidr(ip, "127.0.0.0", 8) ||
    inCidr(ip, "169.254.0.0", 16) ||
    inCidr(ip, "172.16.0.0", 12) ||
    inCidr(ip, "192.0.0.0", 24) ||
    inCidr(ip, "192.0.2.0", 24) ||
    inCidr(ip, "192.168.0.0", 16) ||
    inCidr(ip, "198.18.0.0", 15) ||
    inCidr(ip, "198.51.100.0", 24) ||
    inCidr(ip, "203.0.113.0", 24) ||
    inCidr(ip, "224.0.0.0", 4) ||
    inCidr(ip, "240.0.0.0", 4)
  );
}

function isPrivateIpv6(ip: string): boolean {
  const low = ip.toLowerCase();
  if (low === "::1" || low === "::") return true;
  // fe80::/10 link-local
  if (/^fe[89ab]/.test(low)) return true;
  // fc00::/7 unique-local
  if (/^f[cd]/.test(low)) return true;

  // IPv4-mapped, either dotted (::ffff:10.0.0.1) or the hex form the URL
  // parser normalises it to (::ffff:a00:1).
  const dotted = low.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return isPrivateIpv4(dotted[1]);
  const hex = low.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return isPrivateIpv4(`${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`);
  }
  return false;
}

function isDisallowedAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  if (net.isIPv6(ip)) return isPrivateIpv6(ip);
  return true;
}

export async function assertOutboundUrlAllowed(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http and https URLs are allowed");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");

  if (net.isIP(host)) {
    if (isDisallowedAddress(host)) {
      throw new Error("URL points at a non-public address");
    }
    return;
  }

  let results: { address: string }[];
  try {
    results = await dns.promises.lookup(host, { all: true });
  } catch {
    throw new Error("Could not resolve host");
  }

  if (results.length === 0) {
    throw new Error("Could not resolve host");
  }
  for (const r of results) {
    if (isDisallowedAddress(r.address)) {
      throw new Error("URL resolves to a non-public address");
    }
  }
}
