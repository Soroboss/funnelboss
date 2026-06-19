// SCHEDULER — le cerveau. Traite les sequence_runs "pending" échus : envoie
// l'étape courante (MOCK Phase 3), respecte le plafond anti-spam, avance.
// Déclenché toutes les 15 min. Protégé par CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { processDueSequences } from "@/lib/funnel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  return req.headers.get("authorization") === `Bearer ${env.cronSecret()}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const summary = await processDueSequences();
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
