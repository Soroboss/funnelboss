import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import { SESSION_COOKIE, cookieOptions, signSession } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Anti-brute-force : 5 tentatives / 5 min / IP.
  if (!(await rateLimit(`login:${clientIp(req.headers)}`, 5, 300))) {
    return NextResponse.json({ ok: false, error: "Trop de tentatives. Réessaie dans quelques minutes." }, { status: 429 });
  }
  const { password } = await req.json().catch(() => ({}));
  if (typeof password !== "string" || !(await verifyPassword(password))) {
    return NextResponse.json({ ok: false, error: "Mot de passe incorrect" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(), cookieOptions);
  return res;
}
