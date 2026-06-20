"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, Route, Rocket, MessageSquare, Plug, Menu, LogOut, CircleCheck, ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { insforgeBrowser } from "@/lib/insforge-browser";

const NAV = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/sequences", label: "Séquences", icon: Route },
  { href: "/campagnes", label: "Campagnes", icon: Rocket },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/connexions", label: "Connexions", icon: Plug },
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
          </span>
        );
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate}>{inner}</Link>
        );
      })}
    </nav>
  );
}

function LoginGate({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
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
  async function reset() {
    setErr(""); setBusy(true);
    const r = await fetch("/api/auth/reset", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recovery_code: code, new_password: newPw }),
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
            {mode === "login" ? "Connexion administrateur" : "Réinitialiser le mot de passe"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {mode === "login" ? (
            <>
              <Input type="password" placeholder="Mot de passe" value={pw}
                onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button onClick={login} disabled={busy} className="w-full">{busy ? "…" : "Se connecter"}</Button>
              <button type="button" onClick={() => { setMode("reset"); setErr(""); }}
                className="text-xs text-muted-foreground underline hover:text-foreground">Mot de passe oublié ?</button>
              <div className="flex items-center gap-2 py-1">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">ou</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button variant="outline" className="w-full gap-2"
                onClick={() => insforgeBrowser().auth.signInWithOAuth("google", {
                  redirectTo: window.location.origin + "/auth/callback",
                  additionalParams: { prompt: "select_account" },
                })}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                  <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
                </svg>
                Continuer avec Google
              </Button>
            </>
          ) : (
            <>
              <Input placeholder="Code de récupération" value={code} onChange={(e) => setCode(e.target.value)} />
              <Input type="password" placeholder="Nouveau mot de passe (min 8)" value={newPw}
                onChange={(e) => setNewPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && reset()} />
              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button onClick={reset} disabled={busy} className="w-full">{busy ? "…" : "Réinitialiser"}</Button>
              <button type="button" onClick={() => { setMode("login"); setErr(""); }}
                className="text-xs text-muted-foreground underline hover:text-foreground">← Retour à la connexion</button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SetupGate({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setErr("");
    if (pw.length < 8) return setErr("Mot de passe trop court (min 8).");
    if (pw !== pw2) return setErr("Les mots de passe ne correspondent pas.");
    setBusy(true);
    const r = await fetch("/api/auth/setup", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (r.ok) onDone();
    else setErr((await r.json()).error ?? "Erreur");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-2">
          <Brand />
          <CardTitle className="pt-2 text-center text-base font-medium text-muted-foreground">
            Premier lancement — crée ton mot de passe admin
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input type="password" placeholder="Mot de passe (min 8)" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Input type="password" placeholder="Confirmer" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button onClick={create} disabled={busy} className="w-full">{busy ? "…" : "Créer le compte admin"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<{ hasAdmin: boolean; authed: boolean } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => setStatus({ hasAdmin: !!s.hasAdmin, authed: !!s.authed }))
      .catch(() => setStatus({ hasAdmin: true, authed: false }));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setStatus((s) => (s ? { ...s, authed: false } : s));
  }

  if (status === null) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!status.hasAdmin && !status.authed) return <SetupGate onDone={() => setStatus({ hasAdmin: true, authed: true })} />;
  if (!status.authed) return <LoginGate onAuthed={() => setStatus((s) => ({ ...(s as { hasAdmin: boolean }), authed: true }))} />;

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
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Retour</span>
          </Button>
          <div className="flex-1" />
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={logout} className="gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      <Toaster richColors position="top-center" />
    </div>
  );
}
