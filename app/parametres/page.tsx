"use client";

import { useEffect, useState } from "react";

type Status = { hasAdmin: boolean; authed: boolean };
type SettingsStatus = Record<string, boolean>;

const PROVIDERS: {
  id: "wasender" | "brevo" | "chariow";
  label: string;
  hint: string;
  fields: { key: string; label: string; type?: string }[];
}[] = [
  {
    id: "wasender",
    label: "WasenderAPI · WhatsApp",
    hint: "Session WhatsApp non officielle (QR).",
    fields: [
      { key: "wasender_api_key", label: "Clé API" },
      { key: "wasender_webhook_secret", label: "Secret webhook (STOP)" },
    ],
  },
  {
    id: "brevo",
    label: "Brevo · Email",
    hint: "Clé API REST (xkeysib-…), pas la clé SMTP. Domaine DKIM requis.",
    fields: [
      { key: "brevo_api_key", label: "Clé API" },
      { key: "brevo_sender_email", label: "Email expéditeur", type: "text" },
      { key: "brevo_sender_name", label: "Nom expéditeur", type: "text" },
    ],
  },
  {
    id: "chariow",
    label: "Chariow · Boutique",
    hint: "Clé API lecture (sk_live_…).",
    fields: [{ key: "chariow_api_key", label: "Clé API" }],
  },
];

export default function Parametres() {
  const [status, setStatus] = useState<Status | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [settings, setSettings] = useState<SettingsStatus>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [tests, setTests] = useState<Record<string, { ok: boolean; detail: string }>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function refreshStatus() {
    const r = await fetch("/api/auth/status", { cache: "no-store" });
    const s: Status = await r.json();
    setStatus(s);
    if (s.authed) loadSettings();
  }
  async function loadSettings() {
    const r = await fetch("/api/settings", { cache: "no-store" });
    const j = await r.json();
    setSettings(j.status ?? {});
  }
  useEffect(() => {
    refreshStatus();
  }, []);

  async function submitSetup() {
    setErr("");
    if (pw.length < 8) return setErr("Mot de passe trop court (min 8).");
    if (pw !== pw2) return setErr("Les mots de passe ne correspondent pas.");
    setBusy(true);
    const r = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (!r.ok) return setErr((await r.json()).error ?? "Erreur.");
    setPw(""); setPw2(""); refreshStatus();
  }
  async function submitLogin() {
    setErr(""); setBusy(true);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (!r.ok) return setErr((await r.json()).error ?? "Erreur.");
    setPw(""); refreshStatus();
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setValues({}); setTests({}); refreshStatus();
  }
  async function save() {
    setBusy(true); setSaved(false);
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: values }),
    });
    setBusy(false);
    if (r.ok) {
      const j = await r.json();
      setSettings(j.status ?? {});
      setValues({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }
  async function test(provider: string) {
    setTests((t) => ({ ...t, [provider]: { ok: false, detail: "…" } }));
    const r = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const j = await r.json();
    setTests((t) => ({ ...t, [provider]: { ok: !!j.ok, detail: j.detail ?? "" } }));
  }

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center font-black text-neutral-950 text-sm">
            FB
          </div>
          <div className="text-base font-bold">FunnelBoss · Connexions</div>
        </div>
        {children}
      </div>
    </main>
  );

  if (!status) return shell(<p className="text-neutral-500 text-sm">Chargement…</p>);

  // 1er lancement : créer le mot de passe admin.
  if (!status.hasAdmin) {
    return shell(
      <div className="flex flex-col gap-3">
        <p className="text-sm text-neutral-400">
          Premier lancement — crée ton mot de passe administrateur (il protège tes clés API).
        </p>
        <input className="input" type="password" placeholder="Mot de passe (min 8)" value={pw} onChange={(e) => setPw(e.target.value)} />
        <input className="input" type="password" placeholder="Confirmer" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <button className="btn-primary" disabled={busy} onClick={submitSetup}>
          {busy ? "…" : "Créer le compte admin"}
        </button>
        <style>{styles}</style>
      </div>,
    );
  }

  // Connexion.
  if (!status.authed) {
    return shell(
      <div className="flex flex-col gap-3">
        <p className="text-sm text-neutral-400">Connexion administrateur.</p>
        <input className="input" type="password" placeholder="Mot de passe" value={pw}
          onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitLogin()} />
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <button className="btn-primary" disabled={busy} onClick={submitLogin}>
          {busy ? "…" : "Se connecter"}
        </button>
        <style>{styles}</style>
      </div>,
    );
  }

  // Réglages.
  return shell(
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-400">Colle tes clés, enregistre, puis teste.</p>
        <button className="text-xs text-neutral-500 hover:text-neutral-300 underline" onClick={logout}>
          Déconnexion
        </button>
      </div>

      {PROVIDERS.map((p) => (
        <div key={p.id} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 flex flex-col gap-3">
          <div>
            <div className="text-sm font-semibold">{p.label}</div>
            <div className="text-xs text-neutral-500">{p.hint}</div>
          </div>
          {p.fields.map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-xs text-neutral-400">{f.label}</label>
              <input
                className="input"
                type={f.type ?? "password"}
                placeholder={settings[f.key] ? "••••• enregistré" : "Coller la valeur"}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button className="btn-ghost" onClick={() => test(p.id)}>Tester</button>
            {tests[p.id] && (
              <span className={`text-xs ${tests[p.id].ok ? "text-emerald-400" : "text-red-400"}`}>
                {tests[p.id].ok ? "✓ " : "✗ "}{tests[p.id].detail}
              </span>
            )}
          </div>
        </div>
      ))}

      <button className="btn-primary" disabled={busy} onClick={save}>
        {busy ? "…" : saved ? "✓ Enregistré" : "Enregistrer"}
      </button>
      <style>{styles}</style>
    </div>,
  );
}

const styles = `
  .input { width:100%; background:#0a0a0a; border:1px solid #2a2a2a; border-radius:10px;
    padding:10px 12px; font-size:14px; color:#f5f5f5; outline:none; }
  .input:focus { border-color:#f0930f; }
  .btn-primary { background:#f0930f; color:#0a0a0a; font-weight:600; font-size:14px;
    border:none; border-radius:10px; padding:11px; cursor:pointer; }
  .btn-primary:disabled { opacity:.6; cursor:default; }
  .btn-ghost { background:transparent; color:#d4d4d4; font-size:13px; border:1px solid #2a2a2a;
    border-radius:9px; padding:7px 14px; cursor:pointer; }
  .btn-ghost:hover { border-color:#f0930f; }
`;
