export const fcfa = (n: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0)) + " FCFA";

export const dateFr = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const dateTimeFr = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
