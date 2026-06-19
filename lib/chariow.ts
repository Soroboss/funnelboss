// Client API Chariow (lecture seule). Base https://api.chariow.com/v1, Bearer.
// Pagination par curseur : réponse { data: { data: [...],
// pagination: { next_cursor, has_more } } } (enveloppe parfois aplatie).

import { env } from "./env";

const BASE = "https://api.chariow.com/v1";

async function chariowGet(
  path: string,
  params: Record<string, string> = {},
): Promise<any> {
  const u = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u.toString(), {
    headers: {
      Authorization: `Bearer ${env.chariowKey()}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`chariow GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Récupère TOUTES les pages d'un endpoint liste (customers/sales/products). */
export async function chariowListAll(path: string): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | undefined;
  // Borne de sécurité pour éviter toute boucle infinie.
  for (let i = 0; i < 1000; i++) {
    const params: Record<string, string> = { per_page: "100" };
    if (cursor) params.cursor = cursor;
    const json = await chariowGet(path, params);
    const page: any[] = json?.data?.data ?? json?.data ?? [];
    out.push(...page);
    const pg = json?.data?.pagination ?? json?.pagination;
    if (pg?.has_more && pg?.next_cursor) cursor = pg.next_cursor;
    else break;
  }
  return out;
}
