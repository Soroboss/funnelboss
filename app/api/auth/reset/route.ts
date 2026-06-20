import { NextRequest, NextResponse } from "next/server";
import { resetWithRecovery } from "@/lib/auth";
import { SESSION_COOKIE, cookieOptions, signSession } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await rateLimit(`reset:${clientIp(req.headers)}`, 5, 300))) {
    return NextResponse.json({ ok: false, error: "Trop de tentatives." }, { status: 429 });
  }
  const { recovery_code, new_password } = await req.json().catch(() => ({}));
  if (typeof new_password !== "string" || new_password.length < 8) {
    return NextResponse.json({ ok: false, error: "Mot de passe trop court (min 8)." }, { status: 400 });
  }
  if (typeof recovery_code !== "string" || !(await resetWithRecovery(recovery_code, new_password))) {
    return NextResponse.json({ ok: false, error: "Code de récupération invalide." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(), cookieOptions);
  return res;
}
