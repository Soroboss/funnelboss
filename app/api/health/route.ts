import { NextResponse } from "next/server";

// Health check — no business logic, just proves the deploy is alive.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "chariow-funnel-engine",
    timestamp: new Date().toISOString(),
  });
}
