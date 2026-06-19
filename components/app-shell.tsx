"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, Route, Rocket, MessageSquare, Plug, Menu, LogOut, CircleCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

const NAV = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/sequences", label: "Séquences", icon: Route, soon: true },
  { href: "/campagnes", label: "Campagnes", icon: Rocket, soon: true },
  { href: "/messages", label: "Messages", icon: MessageSquare, soon: true },
  { href: "/parametres", label: "Connexions", icon: Plug },
];

function Brand() {
  return (
    <div className="flex items-center gap-2 px-2">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-bold text-primary-foreground text-sm">
        FB
      </div>
      <span className="text-base font-semibold tracking-tight">FunnelBoss</span>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        const inner = (
          <span
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.soon && <Badge variant="secondary" className="text-[10px]">bientôt</Badge>}
          </span>
        );
        return item.soon ? (
          <div key={item.href} className="cursor-default opacity-70">{inner}</div>
        ) : (
          <Link key={item.href} href={item.href} onClick={onNavigate}>{inner}</Link>
        );
      })}
    </nav>
  );
}

function LoginGate({ onAuthed }: { onAuthed: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function login() {
    setErr(""); setBusy(true);
    const r = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (r.ok) onAuthed();
    else setErr((await r.json()).error ?? "Erreur");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-2">
          <Brand />
          <CardTitle className="pt-2 text-center text-base font-medium text-muted-foreground">
            Connexion administrateur
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            type="password" placeholder="Mot de passe" value={pw}
            onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()}
          />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button onClick={login} disabled={busy} className="w-full">
            {busy ? "…" : "Se connecter"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => setAuthed(!!s.authed))
      .catch(() => setAuthed(false));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthed(false);
  }

  if (authed === null) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!authed) return <LoginGate onAuthed={() => setAuthed(true)} />;

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar p-3 md:flex">
        <div className="py-3"><Brand /></div>
        <div className="mt-2 flex-1"><NavLinks /></div>
        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <CircleCheck className="h-3.5 w-3.5 text-primary" /> Tout est en ligne
        </div>
      </aside>

      {/* Colonne principale */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar p-3">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="py-3"><Brand /></div>
              <div className="mt-2"><NavLinks onNavigate={() => setMobileOpen(false)} /></div>
            </SheetContent>
          </Sheet>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={logout} className="gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
