// Teste une intégration avec la clé stockée (vrai appel API). Garde admin via middleware.
import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ok = (detail: string) => NextResponse.json({ ok: true, detail });
const bad = (detail: string) => NextResponse.json({ ok: false, detail });

export async function POST(req: NextRequest) {
  const { provider } = await req.json().catch(() => ({}));
  try {
    if (provider === "brevo") {
      const key = await getSetting("brevo_api_key");
      if (!key) return bad("Clé Brevo absente.");
      const r = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": key, accept: "application/json" },
      });
      if (!r.ok) return bad(`Brevo a refusé la clé (HTTP ${r.status}).`);
      const acc = await r.json();
      return ok(`Connecté · compte ${acc?.email ?? "Brevo"}`);
    }

    if (provider === "chariow") {
      const key = await getSetting("chariow_api_key");
      if (!key) return bad("Clé Chariow absente.");
      const r = await fetch("https://api.chariow.com/v1/store", {
        headers: { Authorization: `Bearer ${key}`, accept: "application/json" },
      });
      if (!r.ok) return bad(`Chariow a refusé la clé (HTTP ${r.status}).`);
      const j = await r.json();
      return ok(`Connecté · boutique ${j?.data?.name ?? "Chariow"}`);
    }

    if (provider === "wasender") {
      const key = await getSetting("wasender_api_key");
      if (!key) return bad("Clé Wasender absente.");
      // Pas d'endpoint de statut fiable sans envoyer → on valide la présence.
      // Le vrai test = premier envoi réel (Phase 4b).
      return ok("Clé enregistrée · test d'envoi réel en Phase 4b.");
    }

    return bad("Intégration inconnue.");
  } catch (e) {
    return bad(e instanceof Error ? e.message : String(e));
  }
}
