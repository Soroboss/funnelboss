import { NextRequest, NextResponse } from "next/server";
import { listMessages } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const messages = await listMessages({
    channel: sp.get("channel") ?? undefined,
    status: sp.get("status") ?? undefined,
    q: sp.get("q") ?? undefined,
  });
  return NextResponse.json({ ok: true, count: messages.length, messages });
}
