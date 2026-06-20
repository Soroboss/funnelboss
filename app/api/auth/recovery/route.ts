import { NextRequest, NextResponse } from "next/server";
import { generateRecoveryCode } from "@/lib/auth";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await verifySession(req.cookies.get(SESSION_COOKIE)?.value))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const code = await generateRecoveryCode();
  if (!code) return NextResponse.json({ ok: false, error: "Aucun admin." }, { status: 400 });
  return NextResponse.json({ ok: true, code });
}
