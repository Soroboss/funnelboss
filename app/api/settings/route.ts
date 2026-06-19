// Lecture (statut masqué) / écriture des clés. Garde admin via middleware.ts.
import { NextRequest, NextResponse } from "next/server";
import { SETTING_KEYS, setSetting, settingsStatus, type SettingKey } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, status: await settingsStatus() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = body?.updates ?? {};
  const saved: string[] = [];
  for (const k of SETTING_KEYS) {
    const v = updates[k];
    if (typeof v === "string" && v.trim() !== "") {
      await setSetting(k as SettingKey, v.trim());
      saved.push(k);
    }
  }
  return NextResponse.json({ ok: true, saved, status: await settingsStatus() });
}
