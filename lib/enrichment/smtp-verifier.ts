import { resolveMx } from "node:dns/promises";
import { Socket } from "node:net";

// Confirms an email's mailbox actually exists by talking directly to its
// domain's mail server (MX lookup, then a raw SMTP handshake up to RCPT TO,
// never DATA, so no email is ever sent or delivered). This is a real,
// long-standing technique, and a real limitation: most cloud/VPS providers
// (AWS, DigitalOcean, and similar) block outbound port 25 by default to
// fight spam, so a self-hosted Locus instance behind one of those simply
// can't run this check at all. That's why every failure path below resolves
// to "inconclusive" rather than "rejected." An inconclusive result must
// never be treated as proof the email is bad, only a confirmed rejection
// (550-class) should be.
export type SmtpVerifyResult =
  | { outcome: "confirmed"; detail: string }
  | { outcome: "rejected"; detail: string }
  | { outcome: "inconclusive"; detail: string };

const CONNECT_TIMEOUT_MS = 4000;
const OVERALL_TIMEOUT_MS = 7000;
// A generic, non-deliverable sender used only for the MAIL FROM step of the
// handshake. Never used to actually send anything.
const VERIFY_FROM_ADDRESS = "verify@locus.invalid";

type Stage = "greeting" | "ehlo" | "mailfrom" | "rcptto";

export async function verifySmtp(email: string): Promise<SmtpVerifyResult> {
  const domain = email.split("@")[1];
  if (!domain) return { outcome: "inconclusive", detail: "malformed address, no domain" };

  let mxHost: string;
  try {
    const records = await resolveMx(domain);
    if (!records.length) return { outcome: "inconclusive", detail: "no MX records for domain" };
    mxHost = [...records].sort((a, b) => a.priority - b.priority)[0].exchange;
  } catch {
    return { outcome: "inconclusive", detail: "MX lookup failed" };
  }

  return new Promise((resolve) => {
    const socket = new Socket();
    let stage: Stage = "greeting";
    let lineBuffer = "";
    let settled = false;

    const finish = (result: SmtpVerifyResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(overallTimer);
      socket.destroy();
      resolve(result);
    };

    const overallTimer = setTimeout(
      () => finish({ outcome: "inconclusive", detail: "handshake timed out" }),
      OVERALL_TIMEOUT_MS,
    );

    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.on("timeout", () => finish({ outcome: "inconclusive", detail: "connection timed out (port 25 likely blocked)" }));
    socket.on("error", (err) => finish({ outcome: "inconclusive", detail: `connection error: ${(err as Error).message}` }));

    socket.on("data", (chunk: Buffer) => {
      lineBuffer += chunk.toString("utf8");
      const response = extractCompleteResponse(lineBuffer);
      if (!response) return; // still waiting on a multi-line response's final line
      lineBuffer = "";
      handleResponse(response);
    });

    function handleResponse(response: { code: string; text: string }) {
      const { code, text } = response;
      if (stage === "greeting") {
        if (code === "220") {
          stage = "ehlo";
          socket.write(`EHLO locus-verify.local\r\n`);
        } else {
          finish({ outcome: "inconclusive", detail: `unexpected greeting: ${text}` });
        }
      } else if (stage === "ehlo") {
        if (code === "250") {
          stage = "mailfrom";
          socket.write(`MAIL FROM:<${VERIFY_FROM_ADDRESS}>\r\n`);
        } else {
          finish({ outcome: "inconclusive", detail: `EHLO rejected: ${text}` });
        }
      } else if (stage === "mailfrom") {
        if (code === "250") {
          stage = "rcptto";
          socket.write(`RCPT TO:<${email}>\r\n`);
        } else {
          finish({ outcome: "inconclusive", detail: `MAIL FROM rejected: ${text}` });
        }
      } else if (stage === "rcptto") {
        socket.write("QUIT\r\n");
        if (code === "250") {
          finish({ outcome: "confirmed", detail: text });
        } else if (code.startsWith("55")) {
          // 550/551/553: the server is explicitly saying this mailbox does
          // not exist. This is the one signal worth acting on, everything
          // else here is either a real "yes" or "couldn't tell."
          finish({ outcome: "rejected", detail: text });
        } else {
          // 4xx (greylisting, temporary failure) or anything unexpected.
          // A domain running a catch-all (accepts RCPT TO for any address)
          // also lands here as a false "confirmed" if not handled, but
          // catch-all always returns 250, which the branch above already
          // treats as confirmed. That's an inherent limit of this
          // technique, not a bug: the alternative is to gain none of the
          // check's value at all.
          finish({ outcome: "inconclusive", detail: text });
        }
      }
    }

    socket.connect(25, mxHost);
  });
}

// SMTP responses can be a single line ("250 OK") or multi-line, where every
// line but the last uses a hyphen after the code ("250-PIPELINING") and
// only the final line uses a space ("250 OK"). Returns null until a
// complete response (ending in a space-separated final line) has arrived.
function extractCompleteResponse(buffer: string): { code: string; text: string } | null {
  const lines = buffer.split("\r\n").filter((l) => l.length > 0);
  if (lines.length === 0) return null;
  const last = lines[lines.length - 1];
  const match = last.match(/^(\d{3})([ -])(.*)$/);
  if (!match) return null;
  const [, code, separator, text] = match;
  if (separator === "-") return null; // more lines still coming
  return { code, text: text.trim() || last.trim() };
}
