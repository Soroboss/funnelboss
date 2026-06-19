// Liste clients avec segments dérivés + filtre/recherche. Gardé par middleware.
import { NextRequest, NextResponse } from "next/server";
import { listCustomers, SEGMENTS, type Segment } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const segParam = sp.get("segment") ?? "";
  const segment = (SEGMENTS as readonly string[]).includes(segParam)
    ? (segParam as Segment)
    : undefined;
  const q = sp.get("q") ?? undefined;
  const customers = await listCustomers(segment, q);
  return NextResponse.json({ ok: true, count: customers.length, customers });
}
