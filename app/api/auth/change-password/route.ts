import { NextRequest, NextResponse } from "next/server";
import { changePassword } from "@/lib/auth";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await verifySession(req.cookies.get(SESSION_COOKIE)?.value))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { current, next } = await req.json().catch(() => ({}));
  if (typeof next !== "string" || next.length < 8) {
    return NextResponse.json({ ok: false, error: "Nouveau mot de passe trop court (min 8)." }, { status: 400 });
  }
  if (typeof current !== "string" || !(await changePassword(current, next))) {
    return NextResponse.json({ ok: false, error: "Mot de passe actuel incorrect." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
