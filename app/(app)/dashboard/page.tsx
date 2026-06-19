"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fcfa, dateTimeFr } from "@/lib/format";
import { MessageCircle, Mail } from "lucide-react";

type Overview = {
  kpis: { caAttribue: number; relancesActives: number; tauxConversion: number };
  sequences: { id: string; name: string; total: number; converted: number; tauxConversion: number }[];
  logs: { channel: string; recipient: string; template_key: string; provider_status: string; sent_at: string }[];
  series: { weeks: { label: string; ca: number }[]; channels: { whatsapp: number; email: number } };
};

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function statusBadge(s: string) {
  if (s === "failed") return <Badge variant="destructive">échec</Badge>;
  if (s === "skipped_no_recipient") return <Badge variant="secondary">ignoré</Badge>;
  return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">envoyé</Badge>;
}

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    fetch("/api/admin/overview", { cache: "no-store" }).then((r) => r.json()).then(setData);
  }, []);

  const k = data?.kpis;
  const totalSends = (data?.series.channels.whatsapp ?? 0) + (data?.series.channels.email ?? 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Vue d'ensemble</h1>
        <p className="text-sm text-muted-foreground">Performance des relances · 8 dernières semaines</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="CA attribué" value={k ? fcfa(k.caAttribue) : "…"} hint="ventes liées à une conversion" />
        <Kpi label="Relances actives" value={k ? String(k.relancesActives) : "…"} hint="en cours" />
        <Kpi label="Taux de conversion" value={k ? k.tauxConversion + " %" : "…"} hint="sur l'ensemble des runs" />
        <Kpi label="Messages envoyés" value={String(totalSends)} hint="WhatsApp + email" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">CA attribué par semaine</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.series.weeks ?? []} margin={{ left: 4, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="ca" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={48} stroke="var(--muted-foreground)"
                  tickFormatter={(v) => new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v)} />
                <Tooltip formatter={(v) => [fcfa(Number(v)), "CA attribué"]} labelStyle={{ color: "var(--foreground)" }}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="ca" stroke="var(--chart-1)" strokeWidth={2} fill="url(#ca)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Envois par canal</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="flex items-center gap-2 text-sm"><MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp</span>
              <span className="font-semibold">{data?.series.channels.whatsapp ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-sky-600" /> Email</span>
              <span className="font-semibold">{data?.series.channels.email ?? 0}</span>
            </div>
            <div className="pt-1 text-xs font-medium text-muted-foreground">Conversion par séquence</div>
            {(data?.sequences ?? []).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{s.name}</span>
                <span>{s.converted}/{s.total} · {s.tauxConversion}%</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Activité récente</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {(data?.logs ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aucun envoi pour le moment.</p>}
            {(data?.logs ?? []).slice(0, 8).map((l, i) => (
              <div key={i} className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-0">
                <span className="flex min-w-0 items-center gap-2">
                  {l.channel === "email" ? <Mail className="h-3.5 w-3.5 shrink-0 text-sky-600" /> : <MessageCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                  <span className="truncate text-muted-foreground">{l.recipient || "—"}</span>
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{dateTimeFr(l.sent_at)}</span>
                {statusBadge(l.provider_status)}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
