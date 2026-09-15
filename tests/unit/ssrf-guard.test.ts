import { describe, it, expect } from "vitest";
import { assertOutboundUrlAllowed } from "@/lib/security/ssrf-guard";

describe("assertOutboundUrlAllowed", () => {
  it("rejects non-http(s) schemes", async () => {
    await expect(assertOutboundUrlAllowed("ftp://example.com/x")).rejects.toThrow(
      /http and https/,
    );
    await expect(assertOutboundUrlAllowed("file:///etc/passwd")).rejects.toThrow();
  });

  it("rejects a garbage URL", async () => {
    await expect(assertOutboundUrlAllowed("not a url")).rejects.toThrow(/Invalid URL/);
  });

  it("rejects the cloud metadata address", async () => {
    await expect(
      assertOutboundUrlAllowed("http://169.254.169.254/latest/meta-data/"),
    ).rejects.toThrow(/non-public/);
  });

  it("rejects loopback by literal IP and by name", async () => {
    await expect(assertOutboundUrlAllowed("http://127.0.0.1:3000/x")).rejects.toThrow(
      /non-public/,
    );
    await expect(assertOutboundUrlAllowed("http://[::1]/x")).rejects.toThrow(/non-public/);
    await expect(assertOutboundUrlAllowed("http://localhost/x")).rejects.toThrow(
      /non-public/,
    );
  });

  it("rejects RFC1918 private ranges", async () => {
    for (const ip of ["10.0.0.5", "172.16.0.1", "192.168.1.1"]) {
      await expect(assertOutboundUrlAllowed(`http://${ip}/hook`)).rejects.toThrow(
        /non-public/,
      );
    }
  });

  it("rejects an IPv4-mapped IPv6 private address", async () => {
    await expect(
      assertOutboundUrlAllowed("http://[::ffff:10.0.0.1]/x"),
    ).rejects.toThrow(/non-public/);
  });

  it("allows a public literal IP", async () => {
    await expect(assertOutboundUrlAllowed("https://1.1.1.1/hook")).resolves.toBeUndefined();
  });

  it("allows a public hostname", async () => {
    await expect(
      assertOutboundUrlAllowed("https://example.com/endpoint"),
    ).resolves.toBeUndefined();
  });
});
