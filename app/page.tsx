"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle, Route, ShieldCheck, Send, LayoutDashboard } from "lucide-react";

export default function Home() {
  const [live, setLive] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then((d) => setLive(!!d.ok)).catch(() => setLive(false));
  }, []);

  const features = [
    { icon: MessageCircle, title: "Ingestion Chariow", desc: "Ventes & abandons captés en temps réel", on: true },
    { icon: Route, title: "Séquences", desc: "Relances programmées, arrêt à la conversion", on: true },
    { icon: ShieldCheck, title: "Anti-spam", desc: "Jamais 2 messages le même jour", on: true },
    { icon: Send, title: "WhatsApp & email", desc: "Wasender + Brevo", on: true },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">FB</div>
          <div className="leading-tight">
            <div className="font-semibold">FunnelBoss</div>
            <div className="text-xs text-muted-foreground">Bigréussite</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5">
            <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : live === false ? "bg-destructive" : "bg-muted-foreground"}`} />
            {live ? "En ligne" : live === false ? "Hors ligne" : "…"}
          </Badge>
          <Button render={<Link href="/dashboard" />} size="sm">Tableau de bord <ArrowRight className="h-4 w-4" /></Button>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Moteur de relance <span className="text-primary">automatisée</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Chaque vente et chaque panier abandonné de la boutique Chariow déclenche automatiquement
          les bonnes relances WhatsApp &amp; email — au bon moment, sans spammer.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <Button render={<Link href="/dashboard" />} size="lg"><LayoutDashboard className="h-4 w-4" /> Ouvrir le pilotage</Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-4 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <Card key={f.title}>
            <CardContent className="flex flex-col gap-2 p-5">
              <f.icon className="h-5 w-5 text-primary" />
              <div className="font-medium">{f.title}</div>
              <div className="text-sm text-muted-foreground">{f.desc}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        FunnelBoss · FCFA · Côte d'Ivoire
      </footer>
    </main>
  );
}
