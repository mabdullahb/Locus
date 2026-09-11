import { describe, it, expect, vi, beforeEach } from "vitest";

const { instances, FakeSocket } = vi.hoisted(() => {
  // require, not import, since this whole block runs inside vi.hoisted
  // (before ES module imports are set up) so the module system's own
  // static imports aren't available here yet.
  const { EventEmitter } = require("node:events");
  const instances: InstanceType<typeof FakeSocketClass>[] = [];
  class FakeSocketClass extends EventEmitter {
    connect = vi.fn();
    write = vi.fn();
    destroy = vi.fn();
    setTimeout = vi.fn();
    constructor() {
      super();
      instances.push(this);
    }
  }
  return { instances, FakeSocket: FakeSocketClass };
});

vi.mock("node:net", () => ({ Socket: FakeSocket, default: { Socket: FakeSocket } }));

const resolveMx = vi.fn();
vi.mock("node:dns/promises", () => {
  const mockResolveMx = (...args: unknown[]) => resolveMx(...args);
  return { resolveMx: mockResolveMx, default: { resolveMx: mockResolveMx } };
});

import { verifySmtp } from "@/lib/enrichment/smtp-verifier";

function lastSocket(): InstanceType<typeof FakeSocket> {
  return instances[instances.length - 1];
}

// Drives a fake SMTP conversation: replies to whatever the module just
// wrote, in order, one line per call. Real servers can split a single
// response across multiple TCP packets, and the multi-line EHLO test below
// exercises that separately, this helper is for the common one-line-per-
// response cases the other tests don't need to think about the wire format for.
function reply(line: string) {
  lastSocket().emit("data", Buffer.from(line + "\r\n"));
}

describe("verifySmtp", () => {
  beforeEach(() => {
    instances.length = 0;
    resolveMx.mockReset();
  });

  it("is inconclusive for a malformed address, without attempting an MX lookup", async () => {
    const result = await verifySmtp("not-an-email");
    expect(result).toEqual({ outcome: "inconclusive", detail: "malformed address, no domain" });
    expect(resolveMx).not.toHaveBeenCalled();
  });

  it("is inconclusive when the domain has no MX records", async () => {
    resolveMx.mockResolvedValue([]);
    const result = await verifySmtp("a@example.com");
    expect(result.outcome).toBe("inconclusive");
  });

  it("is inconclusive when the MX lookup itself fails", async () => {
    resolveMx.mockRejectedValue(new Error("ENOTFOUND"));
    const result = await verifySmtp("a@example.com");
    expect(result.outcome).toBe("inconclusive");
  });

  it("confirms the mailbox on a clean 250 through the full handshake", async () => {
    resolveMx.mockResolvedValue([{ exchange: "mx.example.com", priority: 10 }]);
    const promise = verifySmtp("real@example.com");
    await vi.waitFor(() => expect(instances.length).toBe(1));

    reply("220 mx.example.com ESMTP ready");
    await vi.waitFor(() => expect(lastSocket().write).toHaveBeenCalledWith(expect.stringContaining("EHLO")));
    reply("250 mx.example.com Hello");
    await vi.waitFor(() => expect(lastSocket().write).toHaveBeenCalledWith(expect.stringContaining("MAIL FROM")));
    reply("250 OK");
    await vi.waitFor(() => expect(lastSocket().write).toHaveBeenCalledWith(expect.stringContaining("RCPT TO")));
    reply("250 OK, mailbox exists");

    const result = await promise;
    expect(result).toEqual({ outcome: "confirmed", detail: "OK, mailbox exists" });
    expect(lastSocket().write).toHaveBeenCalledWith("QUIT\r\n");
  });

  it("correctly parses a multi-line EHLO response before advancing", async () => {
    resolveMx.mockResolvedValue([{ exchange: "mx.example.com", priority: 10 }]);
    const promise = verifySmtp("real@example.com");
    await vi.waitFor(() => expect(instances.length).toBe(1));

    reply("220 mx.example.com ESMTP ready");
    await vi.waitFor(() => expect(lastSocket().write).toHaveBeenCalledWith(expect.stringContaining("EHLO")));
    // A real multi-line EHLO response arriving as separate lines with
    // hyphens on every line but the last, this must NOT be treated as
    // complete until the space-separated final line shows up.
    lastSocket().emit("data", Buffer.from("250-mx.example.com Hello\r\n250-PIPELINING\r\n250 8BITMIME\r\n"));
    await vi.waitFor(() => expect(lastSocket().write).toHaveBeenCalledWith(expect.stringContaining("MAIL FROM")));
    reply("250 OK");
    reply("250 OK");

    const result = await promise;
    expect(result.outcome).toBe("confirmed");
  });

  it("reports a rejected mailbox on a 550-class RCPT TO response", async () => {
    resolveMx.mockResolvedValue([{ exchange: "mx.example.com", priority: 10 }]);
    const promise = verifySmtp("nobody@example.com");
    await vi.waitFor(() => expect(instances.length).toBe(1));

    reply("220 mx.example.com ESMTP ready");
    await vi.waitFor(() => expect(lastSocket().write).toHaveBeenCalledWith(expect.stringContaining("EHLO")));
    reply("250 OK");
    await vi.waitFor(() => expect(lastSocket().write).toHaveBeenCalledWith(expect.stringContaining("MAIL FROM")));
    reply("250 OK");
    await vi.waitFor(() => expect(lastSocket().write).toHaveBeenCalledWith(expect.stringContaining("RCPT TO")));
    reply("550 5.1.1 No such user here");

    const result = await promise;
    expect(result).toEqual({ outcome: "rejected", detail: "5.1.1 No such user here" });
  });

  it("treats a greylist-style 4xx response as inconclusive, not a rejection", async () => {
    resolveMx.mockResolvedValue([{ exchange: "mx.example.com", priority: 10 }]);
    const promise = verifySmtp("real@example.com");
    await vi.waitFor(() => expect(instances.length).toBe(1));

    reply("220 mx.example.com ESMTP ready");
    await vi.waitFor(() => expect(lastSocket().write).toHaveBeenCalledWith(expect.stringContaining("EHLO")));
    reply("250 OK");
    await vi.waitFor(() => expect(lastSocket().write).toHaveBeenCalledWith(expect.stringContaining("MAIL FROM")));
    reply("250 OK");
    await vi.waitFor(() => expect(lastSocket().write).toHaveBeenCalledWith(expect.stringContaining("RCPT TO")));
    reply("450 4.2.1 greylisted, try again later");

    const result = await promise;
    expect(result.outcome).toBe("inconclusive");
  });

  it("is inconclusive, never rejected, when the connection itself fails (port 25 blocked)", async () => {
    resolveMx.mockResolvedValue([{ exchange: "mx.example.com", priority: 10 }]);
    const promise = verifySmtp("real@example.com");
    await vi.waitFor(() => expect(instances.length).toBe(1));

    lastSocket().emit("error", new Error("ECONNREFUSED"));

    const result = await promise;
    expect(result.outcome).toBe("inconclusive");
    expect(result.outcome).not.toBe("rejected");
  });

  it("is inconclusive, never rejected, on a connection timeout", async () => {
    resolveMx.mockResolvedValue([{ exchange: "mx.example.com", priority: 10 }]);
    const promise = verifySmtp("real@example.com");
    await vi.waitFor(() => expect(instances.length).toBe(1));

    lastSocket().emit("timeout");

    const result = await promise;
    expect(result.outcome).toBe("inconclusive");
  });

  it("picks the lowest-priority-number MX host when multiple are returned", async () => {
    resolveMx.mockResolvedValue([
      { exchange: "backup.example.com", priority: 20 },
      { exchange: "primary.example.com", priority: 5 },
    ]);
    const promise = verifySmtp("real@example.com");
    await vi.waitFor(() => expect(instances.length).toBe(1));
    expect(lastSocket().connect).toHaveBeenCalledWith(25, "primary.example.com");

    lastSocket().emit("error", new Error("stop"));
    await promise;
  });
});
