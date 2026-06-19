// Client base de données Insforge (REST PostgREST), serveur uniquement.
// Auth : clé admin en Bearer (bypass RLS). Idempotence via upsert on_conflict.

import { env } from "./env";

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${env.insforgeKey()}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function url(table: string, query = ""): string {
  return `${env.insforgeUrl()}/api/database/records/${table}${query ? `?${query}` : ""}`;
}

/** SELECT avec filtres PostgREST (ex: "status=eq.pending&limit=100"). */
export async function dbSelect<T = Record<string, unknown>>(
  table: string,
  query = "",
): Promise<T[]> {
  const res = await fetch(url(table, query), { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`select ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * UPSERT idempotent : POST + Prefer resolution=merge-duplicates sur la
 * contrainte UNIQUE `onConflict`. Seules les colonnes présentes sont mises à
 * jour en cas de conflit (les autres, ex: total_spent, sont préservées).
 */
export async function dbUpsert<T = Record<string, unknown>>(
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<T[]> {
  const res = await fetch(url(table, `on_conflict=${onConflict}`), {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`upsert ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

/** INSERT simple (retourne les lignes créées). */
export async function dbInsert<T = Record<string, unknown>>(
  table: string,
  rows: Record<string, unknown>[],
): Promise<T[]> {
  const res = await fetch(url(table), {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`insert ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

/** PATCH (update) sur les lignes filtrées. */
export async function dbPatch<T = Record<string, unknown>>(
  table: string,
  filter: string,
  patch: Record<string, unknown>,
): Promise<T[]> {
  const res = await fetch(url(table, filter), {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`patch ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}
