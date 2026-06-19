// Protège les routes de réglages (qui lisent/écrivent des clés) : session admin
// obligatoire. La page /parametres reste publique mais ne reçoit jamais de
// secret (les valeurs ne transitent que via /api/settings, gardé ici).

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export const config = {
  matcher: ["/api/settings", "/api/settings/:path*", "/api/admin/:path*"],
};

export async function middleware(req: NextRequest) {
  const ok = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.next();
}
