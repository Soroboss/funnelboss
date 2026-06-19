"use client";

import { useEffect, useState } from "react";

type Health = { ok: boolean; service: string; timestamp: string };

export default function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [down, setDown] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setDown(true));
  }, []);

  const live = Boolean(health?.ok) && !down;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-md flex flex-col gap-8">
        {/* Marque + statut */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center font-black text-neutral-950">
              FB
            </div>
            <div className="leading-tight">
              <div className="text-lg font-bold tracking-tight">FunnelBoss</div>
              <div className="text-xs text-neutral-400">Bigréussite</div>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
              live
                ? "bg-emerald-500/15 text-emerald-400"
                : down
                  ? "bg-red-500/15 text-red-400"
                  : "bg-neutral-700/40 text-neutral-400"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                live ? "bg-emerald-400 animate-pulse" : down ? "bg-red-400" : "bg-neutral-500"
              }`}
            />
            {live ? "En ligne" : down ? "Hors ligne" : "…"}
          </span>
        </header>

        {/* Hero */}
        <section className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight leading-snug">
            Moteur de relance
            <br />
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              automatisée
            </span>
          </h1>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Chaque vente et chaque panier abandonné de la boutique Chariow déclenche
            automatiquement les bonnes relances WhatsApp &amp; email — au bon moment,
            sans spammer.
          </p>
        </section>

        {/* Pipeline */}
        <section className="grid gap-3">
          {[
            { t: "Ingestion Chariow", d: "Ventes & abandons captés en temps réel", on: true },
            { t: "Séquences", d: "Relances programmées, arrêt à la conversion", on: true },
            { t: "Anti-spam", d: "Jamais 2 messages le même jour", on: true },
            { t: "Envois WhatsApp & email", d: "Wasender + Brevo", on: false },
            { t: "Tableau de bord", d: "Pilotage & KPI (FCFA)", on: false },
          ].map((row) => (
            <div
              key={row.t}
              className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium">{row.t}</div>
                <div className="text-xs text-neutral-500">{row.d}</div>
              </div>
              <span
                className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${
                  row.on
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-neutral-700/40 text-neutral-400"
                }`}
              >
                {row.on ? "actif" : "bientôt"}
              </span>
            </div>
          ))}
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-neutral-600 pt-2">
          {health?.timestamp ? (
            <>API {health.service} · {new Date(health.timestamp).toLocaleString("fr-FR")}</>
          ) : (
            "Vérification du statut…"
          )}
          <div className="mt-1">FCFA · Côte d&apos;Ivoire</div>
        </footer>
      </div>
    </main>
  );
}
