// WhatsApp via WasenderAPI (session non officielle). Clé lue depuis le module
// Connexions. Format E.164 +225 (Côte d'Ivoire).

import { getSetting } from "./settings";

const ENDPOINT = "https://www.wasenderapi.com/api/send-message";

/** Normalise un numéro vers E.164 Côte d'Ivoire (+225...). */
export function normalizeCI(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("225")) return "+" + d;
  return "+225" + d;
}

export type SendResult = {
  ok: boolean;
  msgId?: string;
  status?: string;
  error?: string;
  raw: unknown;
};

export async function sendWhatsApp(to: string, text: string): Promise<SendResult> {
  const key = await getSetting("wasender_api_key");
  if (!key) return { ok: false, error: "Clé Wasender absente", raw: null };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to: normalizeCI(to), text }),
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok || !raw?.success) {
    return { ok: false, error: `Wasender HTTP ${res.status}`, status: raw?.data?.status, raw };
  }
  return { ok: true, msgId: String(raw?.data?.msgId ?? ""), status: raw?.data?.status ?? "in_progress", raw };
}
