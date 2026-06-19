// Réglages / clés d'intégration, stockés en base (table app_settings, RLS
// deny-all). Lus côté serveur uniquement. getSetting() est utilisé par les
// envois (Phase 4b) avec fallback sur les variables d'env.

import { dbSelect, dbUpsert } from "./insforge";

export const SETTING_KEYS = [
  "wasender_api_key",
  "wasender_webhook_secret",
  "brevo_api_key",
  "brevo_sender_email",
  "brevo_sender_name",
  "chariow_api_key",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

// Variable d'env de fallback pour chaque clé (utile avant migration vers le store).
const ENV_FALLBACK: Record<SettingKey, string> = {
  wasender_api_key: "WASENDER_API_KEY",
  wasender_webhook_secret: "WASENDER_WEBHOOK_SECRET",
  brevo_api_key: "BREVO_API_KEY",
  brevo_sender_email: "BREVO_SENDER_EMAIL",
  brevo_sender_name: "BREVO_SENDER_NAME",
  chariow_api_key: "CHARIOW_API_KEY",
};

export async function getSetting(key: SettingKey): Promise<string | null> {
  const rows = await dbSelect<{ value: string }>(
    "app_settings",
    `key=eq.${key}&limit=1`,
  );
  return rows[0]?.value ?? process.env[ENV_FALLBACK[key]] ?? null;
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await dbUpsert("app_settings", [{ key, value }], "key");
}

/** Statut (clé renseignée ou non) — NE renvoie JAMAIS les valeurs. */
export async function settingsStatus(): Promise<Record<SettingKey, boolean>> {
  const rows = await dbSelect<{ key: string; value: string }>(
    "app_settings",
    `key=in.(${SETTING_KEYS.join(",")})`,
  );
  const status = Object.fromEntries(SETTING_KEYS.map((k) => [k, false])) as Record<
    SettingKey,
    boolean
  >;
  for (const r of rows) if (r.value) status[r.key as SettingKey] = true;
  return status;
}
