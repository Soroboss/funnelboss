// Lance la réactivation manuelle sur un segment. Gardé par middleware.
import { NextRequest, NextResponse } from "next/server";
import { reactivateSegment, SEGMENTS, type Segment } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { segment } = await req.json().catch(() => ({}));
  if (!(SEGMENTS as readonly string[]).includes(segment)) {
    return NextResponse.json({ ok: false, error: "segment invalide" }, { status: 400 });
  }
  const result = await reactivateSegment(segment as Segment);
  return NextResponse.json({ ok: true, ...result });
}
