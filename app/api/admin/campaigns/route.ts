import { NextResponse } from "next/server";
import { listCampaigns } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, campaigns: await listCampaigns() });
}
