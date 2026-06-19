// ════════════════════════════════════════════════════════════════════
// backup-daily — GARDE-FOU (Phase 0)
// Exporte les tables critiques vers le storage privé Insforge (bucket
// "backups"), une fois par jour via un schedule cron.
//
// Insforge est jeune (doc self-host mince) → ce backup n'est PAS optionnel.
// Lecture via REST admin (Bearer API_KEY = bypass RLS), paginée.
// Upload via le SDK storage (gère le flux strategy local/S3 en un appel).
// ════════════════════════════════════════════════════════════════════

import { createClient } from "npm:@insforge/sdk";

const TABLES = [
  "customers",
  "products",
  "sales",
  "sequences",
  "sequence_runs",
  "message_logs",
] as const;

const PAGE = 1000; // limite max par requête REST Insforge
const BUCKET = "backups";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return json(null, 204);
  }

  // Secrets réservés auto-injectés par Insforge ; fallback sur les nôtres.
  const baseUrl =
    Deno.env.get("INSFORGE_BASE_URL") ?? Deno.env.get("FUNNEL_BASE_URL");
  const adminKey =
    Deno.env.get("API_KEY") ?? Deno.env.get("FUNNEL_ADMIN_KEY");

  if (!baseUrl || !adminKey) {
    return json(
      { ok: false, error: "Missing INSFORGE_BASE_URL / API_KEY in function env" },
      500,
    );
  }

  try {
    // ── 1. Lire toutes les lignes de chaque table (paginé) ──────────
    const tables: Record<string, unknown[]> = {};
    for (const table of TABLES) {
      const rows: unknown[] = [];
      let offset = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const url = `${baseUrl}/api/database/records/${table}?limit=${PAGE}&offset=${offset}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${adminKey}` },
        });
        if (!res.ok) {
          throw new Error(
            `read ${table} failed: ${res.status} ${await res.text()}`,
          );
        }
        const batch = (await res.json()) as unknown[];
        if (!Array.isArray(batch)) {
          throw new Error(`read ${table}: unexpected payload`);
        }
        rows.push(...batch);
        if (batch.length < PAGE) break;
        offset += PAGE;
      }
      tables[table] = rows;
    }

    // ── 2. Sérialiser le dump ───────────────────────────────────────
    const exportedAt = new Date().toISOString();
    const payload = {
      project: "chariow-funnel-engine",
      exported_at: exportedAt,
      tables,
    };
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    const safeTs = exportedAt.replace(/[:.]/g, "-");
    const key = `daily/backup-${safeTs}.json`;

    // ── 3. Uploader vers le bucket privé "backups" ──────────────────
    const insforge = createClient({ baseUrl, anonKey: adminKey });
    const { data, error } = await insforge.storage
      .from(BUCKET)
      .upload(key, blob);
    if (error) {
      throw new Error(`upload failed: ${error.message ?? String(error)}`);
    }

    const counts = Object.fromEntries(
      Object.entries(tables).map(([t, r]) => [t, r.length]),
    );
    return json({
      ok: true,
      bucket: BUCKET,
      key: data?.key ?? key,
      exported_at: exportedAt,
      counts,
    });
  } catch (e) {
    return json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
}
