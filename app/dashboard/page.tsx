"use client";

import { useCallback, useEffect, useState } from "react";

const fcfa = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0)) + " FCFA";
const SEGMENTS = ["vip", "dormant", "mono_produit", "actif", "prospect"] as const;
type Segment = (typeof SEGMENTS)[number];

type Kpis = { caAttribue: number; relancesActives: number; tauxConversion: number };
type SeqStat = { id: string; name: string; trigger: string; total: number; pending: number; sent: number; stopped: number; converted: number; tauxConversion: number };
type LogRow = { channel: string; recipient: string; template_key: string; provider_status: string; sent_at: string };
type Cust = { id: string; full_name: string | null; email: string | null; whatsapp: string | null; total_spent: number; purchases: number; segments: Segment[] };

export default function Dashboard() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [seqs, setSeqs] = useState<SeqStat[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [custs, setCusts] = useState<Cust[]>([]);
  const [filter, setFilter] = useState<Segment | "">("");
  const [q, setQ] = useState("");
  const [reactSeg, setReactSeg] = useState<Segment>("dormant");
  const [toast, setToast] = useState("");

  const loadCustomers = useCallback(async () => {
    const sp = new URLSearchParams();
    if (filter) sp.set("segment", filter);
    if (q.trim()) sp.set("q", q.trim());
    const r = await fetch(`/api/admin/customers?${sp}`, { cache: "no-store" });
    if (r.ok) setCusts((await r.json()).customers ?? []);
  }, [filter, q]);

  const loadOverview = useCallback(async () => {
    const r = await fetch("/api/admin/overview", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      setKpis(j.kpis); setSeqs(j.sequences ?? []); setLogs(j.logs ?? []);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => setAuthed(s.authed));
  }, []);

  useEffect(() => {
    if (authed) { loadOverview(); loadCustomers(); }
  }, [authed, loadOverview, loadCustomers]);

  useEffect(() => {
    if (authed) loadCustomers();
  }, [filter, authed, loadCustomers]);

  async function login() {
    setErr("");
    const r = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }),
    });
    if (r.ok) { setPw(""); setAuthed(true); }
    else setErr((await r.json()).error ?? "Erreur");
  }

  async function reactivate() {
    setToast("…");
    const r = await fetch("/api/admin/reactivate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ segment: reactSeg }),
    });
    const j = await r.json();
    if (j.ok) { setToast(`${j.enqueued} relance(s) lancée(s) sur ${j.matched} client(s) "${reactSeg}".`); loadOverview(); }
    else setToast(j.error ?? "Erreur");
    setTimeout(() => setToast(""), 5000);
  }

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-5 py-8">
      <div className="w-full max-w-lg mx-auto flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center font-black text-neutral-950 text-sm">FB</div>
            <div className="text-base font-bold">FunnelBoss · Pilotage</div>
          </div>
          <a href="/parametres" className="text-xs text-neutral-500 hover:text-neutral-300 underline">Connexions</a>
        </div>
        {children}
      </div>
      <style>{styles}</style>
    </main>
  );

  if (authed === null) return shell(<p className="text-neutral-500 text-sm">Chargement…</p>);

  if (!authed) {
    return shell(
      <div className="flex flex-col gap-3 max-w-xs">
        <p className="text-sm text-neutral-400">Connexion administrateur.</p>
        <input className="input" type="password" placeholder="Mot de passe" value={pw}
          onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <button className="btn-primary" onClick={login}>Se connecter</button>
      </div>,
    );
  }

  return shell(
    <>
      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="CA attribué" value={kpis ? fcfa(kpis.caAttribue) : "…"} />
        <Kpi label="Relances actives" value={kpis ? String(kpis.relancesActives) : "…"} />
        <Kpi label="Conversion" value={kpis ? kpis.tauxConversion + " %" : "…"} />
      </div>

      {/* Réactivation */}
      <Section title="Lancer une réactivation">
        <div className="flex items-center gap-2">
          <select className="input" value={reactSeg} onChange={(e) => setReactSeg(e.target.value as Segment)} style={{ flex: 1 }}>
            {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn-primary" style={{ padding: "10px 16px" }} onClick={reactivate}>Lancer</button>
        </div>
        {toast && <p className="text-xs text-amber-400 mt-2">{toast}</p>}
      </Section>

      {/* Clients */}
      <Section title="Clients">
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Chip active={filter === ""} onClick={() => setFilter("")}>tous</Chip>
          {SEGMENTS.map((s) => <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>{s}</Chip>)}
        </div>
        <div className="flex gap-2 mb-3">
          <input className="input" placeholder="Rechercher…" value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadCustomers()} />
          <button className="btn-ghost" onClick={loadCustomers}>OK</button>
        </div>
        <div className="flex flex-col gap-2">
          {custs.length === 0 && <p className="text-neutral-600 text-xs">Aucun client.</p>}
          {custs.slice(0, 50).map((c) => (
            <div key={c.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{c.full_name || c.email || c.whatsapp || c.id.slice(0, 8)}</span>
                <span className="text-xs text-neutral-400">{fcfa(c.total_spent)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] text-neutral-500">{c.whatsapp || c.email || "—"} · {c.purchases} achat(s)</span>
                <span className="flex gap-1">{c.segments.map((s) => <span key={s} className="text-[10px] bg-neutral-800 text-neutral-300 rounded px-1.5 py-0.5">{s}</span>)}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Séquences */}
      <Section title="Séquences">
        <div className="flex flex-col gap-2">
          {seqs.map((s) => (
            <div key={s.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-xs text-emerald-400">{s.tauxConversion}% conv.</span>
              </div>
              <div className="text-[11px] text-neutral-500 mt-1">
                {s.total} runs · {s.pending} en cours · {s.converted} convertis · {s.stopped} stoppés
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Logs */}
      <Section title="Derniers envois">
        <div className="flex flex-col gap-1.5">
          {logs.length === 0 && <p className="text-neutral-600 text-xs">Aucun envoi.</p>}
          {logs.slice(0, 30).map((l, i) => (
            <div key={i} className="flex items-center justify-between text-[11px] border-b border-neutral-900 py-1">
              <span className="text-neutral-400">{l.channel === "email" ? "✉️" : "💬"} {l.recipient || "—"}</span>
              <span className="text-neutral-500">{l.template_key}</span>
              <span className={statusColor(l.provider_status)}>{l.provider_status}</span>
            </div>
          ))}
        </div>
      </Section>
    </>,
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-900/60 px-3 py-3">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="text-base font-semibold mt-1">{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`text-[11px] rounded-full px-2.5 py-1 border ${active ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-transparent text-neutral-400 border-neutral-800"}`}>
      {children}
    </button>
  );
}
function statusColor(s: string) {
  if (s === "failed") return "text-red-400";
  if (s === "skipped_no_recipient") return "text-neutral-500";
  return "text-emerald-400";
}

const styles = `
  .input { background:#0a0a0a; border:1px solid #2a2a2a; border-radius:10px; padding:9px 11px; font-size:14px; color:#f5f5f5; outline:none; width:100%; }
  .input:focus { border-color:#f0930f; }
  .btn-primary { background:#f0930f; color:#0a0a0a; font-weight:600; font-size:14px; border:none; border-radius:10px; padding:10px; cursor:pointer; }
  .btn-ghost { background:transparent; color:#d4d4d4; font-size:13px; border:1px solid #2a2a2a; border-radius:9px; padding:7px 14px; cursor:pointer; }
`;
