// Email transactionnel via Brevo. Header "api-key" (≠ clé SMTP). Clés lues
// depuis le module Connexions. Domaine DKIM requis (sinon @brevosend.com).

import { getSetting } from "./settings";

const ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export type EmailResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
  raw: unknown;
};

export async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string,
): Promise<EmailResult> {
  const key = await getSetting("brevo_api_key");
  const senderEmail = await getSetting("brevo_sender_email");
  const senderName = (await getSetting("brevo_sender_name")) ?? "Bigréussite";
  if (!key || !senderEmail) return { ok: false, error: "Brevo non configuré", raw: null };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: `Brevo HTTP ${res.status}`, raw };
  return { ok: true, messageId: raw?.messageId, raw };
}
