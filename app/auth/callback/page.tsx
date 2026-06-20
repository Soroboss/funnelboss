"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { insforgeBrowser } from "@/lib/insforge-browser";

export default function GoogleCallback() {
  const router = useRouter();
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const sb = insforgeBrowser();
        // Le SDK échange automatiquement le `insforge_code` présent dans l'URL.
        await sb.auth.getCurrentUser();
        // getAccessToken (runtime) / getSession (typé) selon la version du SDK.
        const auth = sb.auth as unknown as {
          getAccessToken?: () => Promise<unknown>;
          getSession?: () => Promise<unknown>;
        };
        const pick = (o: unknown): string =>
          typeof o === "string"
            ? o
            : ((o as { accessToken?: string })?.accessToken ??
              (o as { data?: { accessToken?: string; session?: { accessToken?: string } } })?.data?.accessToken ??
              (o as { data?: { session?: { accessToken?: string } } })?.data?.session?.accessToken ??
              (o as { session?: { accessToken?: string } })?.session?.accessToken ??
              "");
        let token = "";
        if (typeof auth.getAccessToken === "function") token = pick(await auth.getAccessToken());
        if (!token && typeof auth.getSession === "function") token = pick(await auth.getSession());
        if (!token) {
          setErr("Session Google introuvable.");
          return;
        }
        const r = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (r.ok) {
          router.replace("/dashboard");
          return;
        }
        const j = await r.json().catch(() => ({}));
        setErr(j.error ?? "Connexion Google refusée.");
      } catch {
        setErr("Échec de la connexion Google.");
      }
    })();
  }, [router]);

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-6 text-center">
      {err ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-destructive">{err}</p>
          <a href="/dashboard" className="text-sm underline">← Retour à la connexion</a>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Connexion Google en cours…</p>
      )}
    </div>
  );
}
