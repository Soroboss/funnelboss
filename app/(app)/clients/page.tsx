"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { fcfa, dateFr, dateTimeFr } from "@/lib/format";
import { cn } from "@/lib/utils";

const SEGMENTS = ["", "vip", "dormant", "mono_produit", "actif", "prospect"] as const;
const SEG_LABEL: Record<string, string> = { "": "Tous", vip: "VIP", dormant: "Dormants", mono_produit: "Mono-produit", actif: "Actifs", prospect: "Prospects" };

type Cust = { id: string; full_name: string | null; email: string | null; whatsapp: string | null; total_spent: number; purchases: number; segments: string[] };

function segColor(s: string) {
  if (s === "vip") return "bg-primary/15 text-primary border-primary/20";
  if (s === "dormant") return "bg-amber-500/15 text-amber-700 border-amber-500/20";
  if (s === "prospect") return "bg-muted text-muted-foreground";
  return "bg-secondary text-secondary-foreground";
}

export default function ClientsPage() {
  const [custs, setCusts] = useState<Cust[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (filter) sp.set("segment", filter);
    if (q.trim()) sp.set("q", q.trim());
    const r = await fetch(`/api/admin/customers?${sp}`, { cache: "no-store" });
    if (r.ok) setCusts((await r.json()).customers ?? []);
    setLoading(false);
  }, [filter, q]);

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function openDetail(id: string) {
    setOpen(true); setDetail(null);
    const r = await fetch(`/api/admin/customers/${id}`, { cache: "no-store" });
    if (r.ok) setDetail(await r.json());
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">{custs.length} client(s){filter ? ` · ${SEG_LABEL[filter]}` : ""}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SEGMENTS.map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
            {SEG_LABEL[s]}
          </Button>
        ))}
        <div className="ml-auto flex gap-2">
          <Input className="w-48" placeholder="Rechercher…" value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <Button variant="outline" size="sm" onClick={load}>OK</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="hidden sm:table-cell">Contact</TableHead>
                <TableHead>Segments</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Chargement…</TableCell></TableRow>}
              {!loading && custs.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Aucun client.</TableCell></TableRow>}
              {custs.slice(0, 100).map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => openDetail(c.id)}>
                  <TableCell className="font-medium">{c.full_name || c.email || c.whatsapp || c.id.slice(0, 8)}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{c.whatsapp || c.email || "—"}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {c.segments.map((s) => <Badge key={s} variant="outline" className={cn("text-[10px]", segColor(s))}>{s}</Badge>)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fcfa(c.total_spent)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{detail?.customer?.full_name || "Fiche client"}</SheetTitle>
          </SheetHeader>
          {!detail && <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>}
          {detail && (
            <div className="mt-4 flex flex-col gap-5 text-sm">
              <div className="flex flex-wrap gap-1">
                {detail.customer.segments.map((s: string) => <Badge key={s} variant="outline" className={cn("text-[10px]", segColor(s))}>{s}</Badge>)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Total dépensé</div><div className="text-lg font-semibold">{fcfa(detail.customer.total_spent)}</div></div>
                <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Achats</div><div className="text-lg font-semibold">{detail.customer.purchases}</div></div>
              </div>
              <div className="space-y-1 text-muted-foreground">
                <div>📱 {detail.customer.whatsapp || "—"}</div>
                <div>✉️ {detail.customer.email || "—"}</div>
              </div>

              <Separator />
              <div>
                <div className="mb-2 font-medium">Ventes ({detail.sales.length})</div>
                {detail.sales.length === 0 && <p className="text-muted-foreground">Aucune vente.</p>}
                {detail.sales.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between border-b py-1.5 last:border-0">
                    <span>{s.status === "successful" ? "✅" : "🟠"} {dateFr(s.occurred_at)}</span>
                    <span className="tabular-nums">{fcfa(s.amount)}</span>
                  </div>
                ))}
              </div>

              <Separator />
              <div>
                <div className="mb-2 font-medium">Séquences ({detail.runs.length})</div>
                {detail.runs.length === 0 && <p className="text-muted-foreground">Aucune séquence.</p>}
                {detail.runs.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between border-b py-1.5 last:border-0">
                    <span>{r.sequence}</span>
                    <Badge variant="secondary" className="text-[10px]">{r.status}</Badge>
                  </div>
                ))}
              </div>

              <Separator />
              <div>
                <div className="mb-2 font-medium">Messages ({detail.messages.length})</div>
                {detail.messages.length === 0 && <p className="text-muted-foreground">Aucun message.</p>}
                {detail.messages.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between border-b py-1.5 text-xs last:border-0">
                    <span className="text-muted-foreground">{m.channel === "email" ? "✉️" : "📱"} {m.template_key}</span>
                    <span>{dateTimeFr(m.sent_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
