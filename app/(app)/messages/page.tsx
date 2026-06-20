"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { dateTimeFr } from "@/lib/format";
import { MessageCircle, Mail } from "lucide-react";

type Msg = {
  id: string; channel: string; recipient: string; template_key: string;
  provider_status: string; category: "sent" | "failed" | "skipped"; sent_at: string;
};

const CHANNELS = [{ v: "", l: "Tous canaux" }, { v: "whatsapp", l: "WhatsApp" }, { v: "email", l: "Email" }];
const STATUSES = [{ v: "", l: "Tous statuts" }, { v: "sent", l: "Envoyés" }, { v: "failed", l: "Échecs" }, { v: "skipped", l: "Ignorés" }];

function statusBadge(cat: string) {
  if (cat === "failed") return <Badge variant="destructive">échec</Badge>;
  if (cat === "skipped") return <Badge variant="secondary">ignoré</Badge>;
  return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">envoyé</Badge>;
}

export default function MessagesPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (channel) sp.set("channel", channel);
    if (status) sp.set("status", status);
    if (q.trim()) sp.set("q", q.trim());
    const r = await fetch(`/api/admin/messages?${sp}`, { cache: "no-store" });
    if (r.ok) setMsgs((await r.json()).messages ?? []);
    setLoading(false);
  }, [channel, status, q]);

  useEffect(() => { load(); }, [channel, status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
        <p className="text-sm text-muted-foreground">Journal de tous les envois WhatsApp &amp; email.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {CHANNELS.map((c) => (
            <Button key={c.v} size="sm" variant={channel === c.v ? "default" : "outline"} onClick={() => setChannel(c.v)}>{c.l}</Button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {STATUSES.map((s) => (
            <Button key={s.v} size="sm" variant={status === s.v ? "default" : "outline"} onClick={() => setStatus(s.v)}>{s.l}</Button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Input className="w-48" placeholder="Rechercher un destinataire…" value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <Button variant="outline" size="sm" onClick={load}>OK</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Destinataire</TableHead>
                <TableHead className="hidden sm:table-cell">Template</TableHead>
                <TableHead className="text-right">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && [...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell>
                </TableRow>
              ))}
              {!loading && msgs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">Aucun message pour le moment.</TableCell></TableRow>
              )}
              {!loading && msgs.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{dateTimeFr(m.sent_at)}</TableCell>
                  <TableCell>
                    {m.channel === "email"
                      ? <span className="flex items-center gap-1.5 text-sky-600"><Mail className="h-4 w-4" /> Email</span>
                      : <span className="flex items-center gap-1.5 text-emerald-600"><MessageCircle className="h-4 w-4" /> WhatsApp</span>}
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate">{m.recipient || "—"}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{m.template_key}</TableCell>
                  <TableCell className="text-right">{statusBadge(m.category)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
