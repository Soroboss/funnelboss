"use client";

import { createClient } from "@insforge/sdk";

// Client InsForge côté navigateur (clé anon publique) — sert UNIQUEMENT au
// flux OAuth Google. L'identité est ensuite vérifiée côté serveur et bridée
// vers notre propre session admin.
let client: ReturnType<typeof createClient> | null = null;

export function insforgeBrowser() {
  if (!client) {
    client = createClient({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL as string,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY as string,
    });
  }
  return client;
}
