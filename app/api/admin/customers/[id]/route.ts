// Fiche client détaillée. Gardé par middleware (/api/admin/*).
import { NextRequest, NextResponse } from "next/server";
import { getCustomerDetail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCustomerDetail(id);
  if (!detail) return NextResponse.json({ ok: false, error: "introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true, ...detail });
}
