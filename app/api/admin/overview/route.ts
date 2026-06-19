// Vue d'ensemble admin : KPI + stats séquences + derniers logs. Gardé par middleware.
import { NextResponse } from "next/server";
import { getKpis, getSequenceStats, getRecentLogs, getOverviewSeries } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [kpis, sequences, logs, series] = await Promise.all([
    getKpis(),
    getSequenceStats(),
    getRecentLogs(50),
    getOverviewSeries(),
  ]);
  return NextResponse.json({ ok: true, kpis, sequences, logs, series });
}
