interface SendResult {
  ok: boolean;
  error?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Sends the password-reset email through Resend. When RESEND_API_KEY is not
// set (local dev, or before an email account exists) it logs the link to the
// server console instead, so the reset flow stays testable end to end.
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Locus <onboarding@resend.dev>";

  if (!apiKey) {
    console.info(`[email] password reset link for ${to}: ${resetLink}`);
    return { ok: true };
  }

  const text = [
    "Someone asked to reset the password for your Locus account.",
    "",
    `Reset it here (this link expires in one hour): ${resetLink}`,
    "",
    "If this was not you, ignore this email and your password stays the same.",
  ].join("\n");

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: "Reset your Locus password",
        text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend responded ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
