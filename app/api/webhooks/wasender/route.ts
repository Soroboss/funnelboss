// Réception WhatsApp (WasenderAPI). Sert à capter les "STOP" / désinscriptions.
// Sécurité : header X-Webhook-Signature comparé directement au secret (Wasender
// ne fait pas de HMAC). Event entrant = "messages.upsert" (format Baileys).

import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { stopRunsByWhatsapp } from "@/lib/funnel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STOP_WORDS = new Set(["STOP", "STOP.", "DÉSABO", "DESABO", "DESABONNER", "UNSUBSCRIBE"]);

export async function POST(req: NextRequest) {
  const secret = await getSetting("wasender_webhook_secret");
  const sig = req.headers.get("x-webhook-signature");
  if (!secret || sig !== secret) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  try {
    if (payload?.event === "messages.upsert") {
      const data = payload.data;
      // On ignore nos propres messages sortants.
      if (!data?.key?.fromMe) {
        const jid: string = data?.key?.remoteJid ?? "";
        const number = jid.split("@")[0];
        const body: string = (
          data?.message?.conversation ??
          data?.message?.extendedTextMessage?.text ??
          ""
        )
          .trim()
          .toUpperCase();
        if (STOP_WORDS.has(body)) {
          const stopped = await stopRunsByWhatsapp(number);
          return NextResponse.json({ ok: true, action: "stopped", runs: stopped });
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
