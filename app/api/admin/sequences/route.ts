import { NextResponse } from "next/server";
import { listSequences } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, sequences: await listSequences() });
}
