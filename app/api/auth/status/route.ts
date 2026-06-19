import { NextRequest, NextResponse } from "next/server";
import { hasAdmin } from "@/lib/auth";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authed = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  return NextResponse.json({ hasAdmin: await hasAdmin(), authed });
}
