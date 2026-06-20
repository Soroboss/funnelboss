"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateTimeFr } from "@/lib/format";
import { Rocket } from "lucide-react";

const SEGMENTS = ["dormant", "vip", "mono_produit", "actif", "prospect"] as const;
const SEG_LABEL: Record<string, string> = { dormant: "Dormants", vip: "VIP", mono_produit: "Mono-produit", actif: "Actifs", prospect: "Prospects" };

type Campaign = { id: string; segment: string; matched: number; enqueued: number; created_at: string };

export default function CampagnesPage() {
  const [segment, setSegment] = useState<string>("dormant");
  const [busy, setBusy] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  async function load() {
    const r = await fetch("/api/admin/campaigns", { cache: "no-store" });
    if (r.ok) setCampaigns((await r.json()).campaigns ?? []);
  }
  useEffect(() => { load(); }, []);

  async function launch() {
    setBusy(true);
    const r = await fetch("/api/admin/reactivate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ segment }),
    });
    const j = await r.json();
    setBusy(false);
    if (j.ok) {
      toast.success(`Campagne lancée`, { description: `${j.enqueued} relance(s) sur ${j.matched} client(s) « ${SEG_LABEL[segment]} »` });
      load();
    } else {
      toast.error(j.error ?? "Erreur");
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Campagnes</h1>
        <p className="text-sm text-muted-foreground">Lance une réactivation ciblée par segment et suis l'historique.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Nouvelle réactivation</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((s) => (
              <Button key={s} size="sm" variant={segment === s ? "default" : "outline"} onClick={() => setSegment(s)}>
                {SEG_LABEL[s]}
              </Button>
            ))}
          </div>
          <div>
            <Button onClick={launch} disabled={busy} size="lg">
              <Rocket className="h-4 w-4" /> {busy ? "Lancement…" : `Lancer sur les ${SEG_LABEL[segment]}`}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Crée une séquence « Réactivation » pour chaque client du segment ayant un contact. Idempotent : pas de doublon si une relance est déjà en cours.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Historique</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead className="text-right">Ciblés</TableHead>
                <TableHead className="text-right">Lancées</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 && (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Aucune campagne pour le moment.</TableCell></TableRow>
              )}
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground">{dateTimeFr(c.created_at)}</TableCell>
                  <TableCell><Badge variant="outline">{SEG_LABEL[c.segment] ?? c.segment}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{c.matched}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{c.enqueued}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
