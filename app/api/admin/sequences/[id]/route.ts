import { NextRequest, NextResponse } from "next/server";
import { updateSequence } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const rows = await updateSequence(params.id, body);
  return NextResponse.json({ ok: true, updated: rows });
}
