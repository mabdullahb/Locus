import { describe, it, expect, afterEach } from "vitest";
import { getBaseUrl } from "@/lib/enrichment/providers/nine-router";

const KEYS = ["NINE_ROUTER_BASE_URL", "NINE_ROUTER_ALLOW_INSECURE_HTTP"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function set(base?: string, allowHttp?: string) {
  if (base === undefined) delete process.env.NINE_ROUTER_BASE_URL;
  else process.env.NINE_ROUTER_BASE_URL = base;
  if (allowHttp === undefined) delete process.env.NINE_ROUTER_ALLOW_INSECURE_HTTP;
  else process.env.NINE_ROUTER_ALLOW_INSECURE_HTTP = allowHttp;
}

describe("nine-router getBaseUrl", () => {
  it("throws a clear error when unset", () => {
    set(undefined);
    expect(() => getBaseUrl()).toThrow(/not configured/);
  });

  it("throws on a non-URL value", () => {
    set("not a url");
    expect(() => getBaseUrl()).toThrow(/not a valid URL/);
  });

  it("accepts any https URL and trims trailing slashes", () => {
    set("https://router.example.com/v1///");
    expect(getBaseUrl()).toBe("https://router.example.com/v1");
  });

  it("accepts http to localhost and private ranges without the opt-in", () => {
    for (const base of [
      "http://localhost:11434/v1",
      "http://127.0.0.1:20128/v1",
      "http://192.168.1.50:8080/v1",
      "http://10.0.0.4/v1",
      "http://172.16.5.5/v1",
    ]) {
      set(base);
      expect(getBaseUrl()).toBe(base);
    }
  });

  it("rejects http to a public host unless the opt-in is set", () => {
    set("http://170.9.245.16:20128/v1");
    expect(() => getBaseUrl()).toThrow(/in the clear/);

    set("http://170.9.245.16:20128/v1", "true");
    expect(getBaseUrl()).toBe("http://170.9.245.16:20128/v1");
  });

  it("rejects a non-http(s) scheme", () => {
    set("ftp://router.example.com/v1");
    expect(() => getBaseUrl()).toThrow(/http or https/);
  });
});
