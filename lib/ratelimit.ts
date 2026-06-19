// Rate-limiting fenêtre fixe via la fonction Postgres rate_hit (atomique).
// Fail-open : si le limiteur a un souci, on ne bloque PAS le service.

import { env } from "./env";

export async function rateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const res = await fetch(`${env.insforgeUrl()}/api/database/rpc/rate_hit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.insforgeKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds }),
    });
    if (!res.ok) return true;
    return (await res.json()) === true;
  } catch {
    return true;
  }
}

/** IP cliente depuis les en-têtes (Vercel : x-forwarded-for). */
export function clientIp(headers: Headers): string {
  return (headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}
