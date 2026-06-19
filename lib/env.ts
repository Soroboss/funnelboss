// Accès typé aux variables d'environnement SERVEUR.
// Getters paresseux : on ne lit/valide qu'à l'exécution (pas au build),
// pour qu'un build passe même si une variable runtime n'est pas encore posée.
// JAMAIS de secret exposé au client (pas de NEXT_PUBLIC_).

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
  return v;
}

export const env = {
  // Insforge = base de données (Postgres). SERVICE_KEY = clé admin (bypass RLS).
  insforgeUrl: () => required("INSFORGE_PROJECT_URL").replace(/\/$/, ""),
  insforgeKey: () => required("INSFORGE_SERVICE_KEY"),

  // Chariow = source des données (lecture seule).
  chariowKey: () => required("CHARIOW_API_KEY"),

  // Webhook Chariow : Chariow ne signe pas ses Pulses → on protège l'URL
  // par un token secret passé en query (?token=...) et vérifié côté route.
  chariowWebhookSecret: () => required("CHARIOW_WEBHOOK_SECRET"),

  // Vercel Cron envoie "Authorization: Bearer <CRON_SECRET>" si la var existe.
  cronSecret: () => required("CRON_SECRET"),
};
