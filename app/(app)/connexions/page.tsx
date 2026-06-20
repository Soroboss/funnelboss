"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type SettingsStatus = Record<string, boolean>;

const PROVIDERS: {
  id: "wasender" | "brevo" | "chariow";
  label: string;
  hint: string;
  fields: { key: string; label: string; type?: string }[];
}[] = [
  { id: "wasender", label: "WasenderAPI · WhatsApp", hint: "Session WhatsApp non officielle (QR).",
    fields: [{ key: "wasender_api_key", label: "Clé API" }, { key: "wasender_webhook_secret", label: "Secret webhook (STOP)" }] },
  { id: "brevo", label: "Brevo · Email", hint: "Clé API REST (xkeysib-…), pas la clé SMTP. Domaine DKIM requis.",
    fields: [{ key: "brevo_api_key", label: "Clé API" }, { key: "brevo_sender_email", label: "Email expéditeur", type: "text" }, { key: "brevo_sender_name", label: "Nom expéditeur", type: "text" }] },
  { id: "chariow", label: "Chariow · Boutique", hint: "Clé API lecture (sk_live_…).",
    fields: [{ key: "chariow_api_key", label: "Clé API" }] },
];

export default function ConnexionsPage() {
  const [status, setStatus] = useState<SettingsStatus>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [tests, setTests] = useState<Record<string, { ok: boolean; detail: string; loading?: boolean }>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    const r = await fetch("/api/settings", { cache: "no-store" });
    if (r.ok) setStatus((await r.json()).status ?? {});
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setBusy(true); setSaved(false);
    const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updates: values }) });
    setBusy(false);
    if (r.ok) { setStatus((await r.json()).status ?? {}); setValues({}); setSaved(true); setTimeout(() => setSaved(false), 2500); }
  }
  async function test(provider: string) {
    setTests((t) => ({ ...t, [provider]: { ok: false, detail: "", loading: true } }));
    const r = await fetch("/api/settings/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });
    const j = await r.json();
    setTests((t) => ({ ...t, [provider]: { ok: !!j.ok, detail: j.detail ?? "" } }));
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Connexions</h1>
        <p className="text-sm text-muted-foreground">Colle tes clés, enregistre, puis teste chaque intégration.</p>
      </div>

      {PROVIDERS.map((p) => (
        <Card key={p.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              {p.label}
              {status[p.fields[0].key] && <Badge variant="secondary" className="font-normal">configuré</Badge>}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{p.hint}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {p.fields.map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <Label className="text-xs">{f.label}</Label>
                <Input type={f.type ?? "password"} placeholder={status[f.key] ? "••••• enregistré" : "Coller la valeur"}
                  value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => test(p.id)}>Tester</Button>
              {tests[p.id]?.loading && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> test…</span>}
              {tests[p.id] && !tests[p.id].loading && (
                <span className={`flex items-center gap-1.5 text-xs ${tests[p.id].ok ? "text-emerald-600" : "text-destructive"}`}>
                  {tests[p.id].ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {tests[p.id].detail}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={busy} size="lg">{busy ? "…" : saved ? "✓ Enregistré" : "Enregistrer"}</Button>
      </div>
    </div>
  );
}
