"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, MessageCircle, Mail } from "lucide-react";

type Step = { channel: "whatsapp" | "email"; delay_hours: number; template_key: string };
type Seq = {
  id: string; name: string; trigger: string; steps: Step[]; is_active: boolean;
  total: number; pending: number; converted: number; tauxConversion: number;
};

const TRIGGER_LABEL: Record<string, string> = {
  abandoned_sale: "Panier abandonné", successful_sale: "Après achat", manual_reactivation: "Réactivation manuelle",
};

export default function SequencesPage() {
  const [seqs, setSeqs] = useState<Seq[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/admin/sequences", { cache: "no-store" });
    if (r.ok) setSeqs((await r.json()).sequences ?? []);
  }
  useEffect(() => { load(); }, []);

  function patchLocal(id: string, fn: (s: Seq) => Seq) {
    setSeqs((arr) => arr.map((s) => (s.id === id ? fn(s) : s)));
  }
  function setStep(id: string, i: number, k: keyof Step, v: string | number) {
    patchLocal(id, (s) => ({ ...s, steps: s.steps.map((st, j) => (j === i ? { ...st, [k]: v } : st)) }));
  }
  function addStep(id: string) {
    patchLocal(id, (s) => ({ ...s, steps: [...s.steps, { channel: "whatsapp", delay_hours: 24, template_key: "" }] }));
  }
  function removeStep(id: string, i: number) {
    patchLocal(id, (s) => ({ ...s, steps: s.steps.filter((_, j) => j !== i) }));
  }

  async function save(s: Seq) {
    setSaving(s.id);
    await fetch(`/api/admin/sequences/${s.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: s.steps, is_active: s.is_active, name: s.name }),
    });
    setSaving(null);
  }
  async function toggleActive(s: Seq, v: boolean) {
    patchLocal(s.id, (x) => ({ ...x, is_active: v }));
    await fetch(`/api/admin/sequences/${s.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: v }),
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Séquences</h1>
        <p className="text-sm text-muted-foreground">Étapes, délais et templates de chaque scénario de relance.</p>
      </div>

      {seqs.map((s) => (
        <Card key={s.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                {s.name}
                <Badge variant="outline">{TRIGGER_LABEL[s.trigger] ?? s.trigger}</Badge>
              </span>
              <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                {s.is_active ? "active" : "inactive"}
                <Switch checked={s.is_active} onCheckedChange={(v: boolean) => toggleActive(s, v)} />
              </span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {s.total} runs · {s.pending} en cours · {s.converted} convertis · {s.tauxConversion}% conv.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {s.steps.map((st, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border p-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
                <select
                  value={st.channel}
                  onChange={(e) => setStep(s.id, i, "channel", e.target.value)}
                  className="h-9 rounded-md border bg-transparent px-2 text-sm"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                </select>
                <div className="flex items-center gap-1">
                  <Input type="number" min={0} value={st.delay_hours} className="w-20"
                    onChange={(e) => setStep(s.id, i, "delay_hours", Number(e.target.value))} />
                  <span className="text-xs text-muted-foreground">h</span>
                </div>
                <Input value={st.template_key} placeholder="template_key" className="flex-1"
                  onChange={(e) => setStep(s.id, i, "template_key", e.target.value)} />
                <Button variant="ghost" size="icon" onClick={() => removeStep(s.id, i)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <Button variant="outline" size="sm" onClick={() => addStep(s.id)}>
                <Plus className="h-4 w-4" /> Ajouter une étape
              </Button>
              <Button size="sm" onClick={() => save(s)} disabled={saving === s.id}>
                {saving === s.id ? "…" : "Enregistrer"}
              </Button>
            </div>
            <div className="flex gap-4 pt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> WhatsApp</span>
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
