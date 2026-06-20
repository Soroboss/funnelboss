// Bridge OAuth Google : vérifie le token InsForge, contrôle que l'email est
// autorisé (allowlist), puis émet NOTRE session admin. Accès restreint.
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { SESSION_COOKIE, cookieOptions, signSession } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = (process.env.GOOGLE_ALLOWED_EMAILS ?? "soroboss.bossimpact@gmail.com")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export async function POST(req: NextRequest) {
  if (!(await rateLimit(`google:${clientIp(req.headers)}`, 10, 300))) {
    return NextResponse.json({ ok: false, error: "Trop de tentatives." }, { status: 429 });
  }
  const { token } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || !token) {
    return NextResponse.json({ ok: false, error: "Token manquant." }, { status: 400 });
  }

  // Vérifie le token auprès d'InsForge → email authentique (non issu du client).
  const res = await fetch(`${env.insforgeUrl()}/api/auth/sessions/current`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "Session Google invalide." }, { status: 401 });
  }
  const data = await res.json().catch(() => null);
  const email = String(data?.user?.email ?? data?.email ?? "").toLowerCase();

  if (!email || !ALLOWED.includes(email)) {
    return NextResponse.json(
      { ok: false, error: "Ce compte Google n'est pas autorisé à accéder à l'administration." },
      { status: 403 },
    );
  }

  const out = NextResponse.json({ ok: true });
  out.cookies.set(SESSION_COOKIE, await signSession(), cookieOptions);
  return out;
}
