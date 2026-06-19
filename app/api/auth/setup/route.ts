import { NextRequest, NextResponse } from "next/server";
import { hasAdmin, createAdmin } from "@/lib/auth";
import { SESSION_COOKIE, cookieOptions, signSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({}));
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ ok: false, error: "Mot de passe trop court (min 8)" }, { status: 400 });
  }
  if (await hasAdmin()) {
    return NextResponse.json({ ok: false, error: "Admin déjà configuré" }, { status: 409 });
  }
  await createAdmin(password);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(), cookieOptions);
  return res;
}
