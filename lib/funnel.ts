// Logique métier FunnelBoss : mapping Chariow → Insforge, upserts idempotents,
// mise en file des séquences, règles d'arrêt, et moteur (envois RÉELS Wasender/
// Brevo en Phase 4b, via templates ; clés lues depuis le module Connexions).

import { dbSelect, dbUpsert, dbInsert, dbPatch } from "./insforge";
import { sendWhatsApp } from "./wasender";
import { sendEmail } from "./brevo";
import { renderTemplate, type TemplateVars } from "./templates";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a));

/** Construit une ligne d'upsert sans les champs nullish (sauf la clé), pour ne
 *  PAS écraser une valeur existante avec null lors d'un merge-duplicates. */
function pruned(key: Record<string, unknown>, fields: Record<string, unknown>): Record<string, unknown> {
  const row = { ...key };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== null && v !== undefined && v !== "") row[k] = v;
  }
  return row;
}

export type Step = { channel: "whatsapp" | "email"; delay_hours: number; template_key: string };
type Sequence = { id: string; name: string; trigger: string; steps: Step[]; is_active: boolean };
type Customer = { id: string; chariow_id: string; email: string | null; whatsapp: string | null; full_name: string | null };
type Run = { id: string; customer_id: string; sequence_id: string; current_step: number; status: string; next_due_at: string | null };

// ── Mappings Chariow → tables ────────────────────────────────────────

/** Upsert d'un client à partir d'un objet customer Chariow. Retourne l'id interne. */
export async function upsertCustomer(c: any): Promise<Customer> {
  const full_name =
    c?.name ?? ([c?.first_name, c?.last_name].filter(Boolean).join(" ") || null);
  const row = pruned({ chariow_id: c.id }, {
    email: c?.email,
    whatsapp: c?.phone,
    full_name,
  });
  const rows = await dbUpsert<Customer>("customers", [row], "chariow_id");
  return rows[0];
}

/** Upsert d'un produit Chariow. */
export async function upsertProduct(p: any): Promise<void> {
  const price = p?.price?.value ?? p?.pricing?.price?.value;
  const row = pruned({ chariow_product_id: p.id }, {
    name: p?.name,
    slug: p?.slug,
    price,
    checkout_ref: p?.url ?? p?.checkout?.url,
  });
  await dbUpsert("products", [row], "chariow_product_id");
}

/** Retrouve l'id interne d'un client par son chariow_id (ou null). */
export async function findCustomerIdByChariow(chariowId: string): Promise<string | null> {
  const rows = await dbSelect<{ id: string }>(
    "customers",
    `chariow_id=eq.${chariowId}&select=id&limit=1`,
  );
  return rows[0]?.id ?? null;
}

/** Mappe un statut de vente Chariow vers notre enum (ou null si non pertinent). */
export function mapSaleStatus(s: string | undefined): "successful" | "abandoned" | null {
  if (s === "completed" || s === "successful") return "successful";
  if (s === "abandoned") return "abandoned";
  return null;
}

/** Upsert d'une vente (idempotent sur chariow_sale_id). */
export async function upsertSale(args: {
  chariow_sale_id: string;
  customer_id: string | null;
  product_ref: string | null;
  amount: number | null;
  status: "successful" | "abandoned";
  occurred_at: string | null;
  checkout_url?: string | null;
}): Promise<void> {
  await dbUpsert("sales", [pruned({ chariow_sale_id: args.chariow_sale_id }, {
    customer_id: args.customer_id,
    product_ref: args.product_ref,
    amount: args.amount,
    status: args.status,
    occurred_at: args.occurred_at,
    checkout_url: args.checkout_url,
  })], "chariow_sale_id");
}

// ── Séquences : lookup, enqueue, stop ────────────────────────────────

async function activeSequencesByTrigger(trigger: string): Promise<Sequence[]> {
  return dbSelect<Sequence>(
    "sequences",
    `trigger=eq.${trigger}&is_active=eq.true`,
  );
}

function dueAtFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

/**
 * Met une séquence en file pour un client. Idempotent : si un run "pending"
 * existe déjà pour ce couple (client, séquence), on ne recrée rien.
 */
export async function enqueueSequence(customerId: string, seq: Sequence): Promise<boolean> {
  const existing = await dbSelect<Run>(
    "sequence_runs",
    `customer_id=eq.${customerId}&sequence_id=eq.${seq.id}&status=eq.pending&limit=1`,
  );
  if (existing.length > 0) return false;

  const steps = Array.isArray(seq.steps) ? seq.steps : [];
  const firstDelay = steps[0]?.delay_hours ?? 0;
  await dbInsert("sequence_runs", [{
    customer_id: customerId,
    sequence_id: seq.id,
    current_step: 0,
    status: "pending",
    next_due_at: dueAtFromNow(firstDelay),
  }]);
  return true;
}

/** Enqueue toutes les séquences actives d'un trigger donné. */
export async function enqueueByTrigger(customerId: string, trigger: string): Promise<void> {
  const seqs = await activeSequencesByTrigger(trigger);
  for (const seq of seqs) await enqueueSequence(customerId, seq);
}

/**
 * Conversion : stoppe net les runs d'abandon en cours d'un client
 * (status pending → converted). Appelé quand le client achète.
 */
export async function stopAbandonRunsForCustomer(customerId: string): Promise<void> {
  const abandonSeqs = await activeSequencesByTrigger("abandoned_sale");
  if (abandonSeqs.length === 0) return;
  const ids = abandonSeqs.map((s) => s.id).join(",");
  await dbPatch(
    "sequence_runs",
    `customer_id=eq.${customerId}&status=eq.pending&sequence_id=in.(${ids})`,
    { status: "converted" },
  );
}

// ── Moteur de séquences (scheduler) ──────────────────────────────────

function utcMidnightISO(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

/** Plafond anti-spam : le client a-t-il déjà reçu un message aujourd'hui ? */
async function messagedToday(customerId: string): Promise<boolean> {
  const runs = await dbSelect<{ id: string }>(
    "sequence_runs",
    `customer_id=eq.${customerId}&select=id`,
  );
  if (runs.length === 0) return false;
  const ids = runs.map((r) => r.id).join(",");
  // Ne compte que les envois réellement partis (pas les échecs/skips).
  const msgs = await dbSelect(
    "message_logs",
    `sequence_run_id=in.(${ids})&sent_at=gte.${utcMidnightISO()}&provider_status=not.in.(failed,skipped_no_recipient)&limit=1`,
  );
  return msgs.length > 0;
}

async function logMessage(
  run: Run,
  step: Step,
  recipient: string,
  status: string,
  providerMessageId: string | null,
  raw: unknown,
): Promise<void> {
  await dbInsert("message_logs", [{
    sequence_run_id: run.id,
    channel: step.channel,
    recipient,
    template_key: step.template_key,
    provider_status: status,
    provider_message_id: providerMessageId,
    raw_response: raw ?? null,
  }]);
}

/** Variables de template pour un client (prénom, produit, lien checkout, promo). */
async function buildContext(customer: Customer): Promise<TemplateVars> {
  const prenom = (customer.full_name ?? "").trim().split(/\s+/)[0] || "👋";

  // Dernière vente du client → produit + lien de reprise du checkout.
  const sales = await dbSelect<{ product_ref: string | null; checkout_url: string | null }>(
    "sales",
    `customer_id=eq.${customer.id}&order=occurred_at.desc.nullslast&limit=1`,
  );
  const sale = sales[0];

  let produit = "votre commande";
  if (sale?.product_ref) {
    const prods = await dbSelect<{ name: string }>(
      "products",
      `chariow_product_id=eq.${sale.product_ref}&select=name&limit=1`,
    );
    if (prods[0]?.name) produit = prods[0].name;
  }

  return {
    prenom,
    produit,
    lien_checkout: sale?.checkout_url ?? "https://bigreussite.com",
    code_promo: "BIGREUSSITE",
  };
}

/** Envoie réellement l'étape (WhatsApp ou email), log le résultat. */
async function dispatchStep(run: Run, step: Step, customer: Customer): Promise<"sent" | "failed" | "skipped"> {
  const recipient = step.channel === "email" ? customer.email : customer.whatsapp;
  if (!recipient) {
    await logMessage(run, step, "", "skipped_no_recipient", null, null);
    return "skipped";
  }

  const vars = await buildContext(customer);
  const rendered = renderTemplate(step.template_key, step.channel, vars);
  if (!rendered) {
    await logMessage(run, step, recipient, "failed", null, { error: "template introuvable" });
    return "failed";
  }

  if (step.channel === "whatsapp") {
    await sleep(randInt(2000, 6000)); // délai aléatoire anti-ban
    const r = await sendWhatsApp(recipient, (rendered as { text: string }).text);
    await logMessage(run, step, recipient, r.ok ? (r.status ?? "sent") : "failed", r.msgId ?? null, r.raw);
    return r.ok ? "sent" : "failed";
  }

  const { subject, html } = rendered as { subject: string; html: string };
  const r = await sendEmail(recipient, subject, html);
  await logMessage(run, step, recipient, r.ok ? "sent" : "failed", r.messageId ?? null, r.raw);
  return r.ok ? "sent" : "failed";
}

/** Réception STOP : passe en "stopped" les runs pending du client (par numéro WhatsApp). */
export async function stopRunsByWhatsapp(rawNumber: string): Promise<number> {
  const digits = (rawNumber || "").replace(/\D/g, "");
  if (digits.length < 6) return 0;
  const last = digits.slice(-9); // partie significative (insensible au préfixe +225)
  const customers = await dbSelect<{ id: string }>("customers", `whatsapp=ilike.*${last}*&select=id`);
  let stopped = 0;
  for (const c of customers) {
    const res = await dbPatch(
      "sequence_runs",
      `customer_id=eq.${c.id}&status=eq.pending`,
      { status: "stopped" },
    );
    stopped += Array.isArray(res) ? res.length : 0;
  }
  return stopped;
}

/**
 * Traite les runs "pending" échus : envoie l'étape courante (mock), respecte le
 * plafond anti-spam, avance l'étape, recalcule next_due_at. Retourne un résumé.
 */
export async function processDueSequences(): Promise<{ processed: number; sent: number; deferred: number; finished: number }> {
  const now = new Date().toISOString();
  const runs = await dbSelect<Run>(
    "sequence_runs",
    `status=eq.pending&next_due_at=lte.${now}&order=next_due_at.asc&limit=200`,
  );

  let sent = 0, deferred = 0, finished = 0;

  for (const run of runs) {
    const seqRows = await dbSelect<Sequence>("sequences", `id=eq.${run.sequence_id}&limit=1`);
    const seq = seqRows[0];
    const steps: Step[] = Array.isArray(seq?.steps) ? seq.steps : [];
    const step = steps[run.current_step];

    // Plus d'étape → run terminé.
    if (!step) {
      await dbPatch("sequence_runs", `id=eq.${run.id}`, { status: "sent", next_due_at: null });
      finished++;
      continue;
    }

    // Anti-spam : jamais 2 messages le même jour au même client.
    if (await messagedToday(run.customer_id)) {
      await dbPatch("sequence_runs", `id=eq.${run.id}`, { next_due_at: dueAtFromNow(24) });
      deferred++;
      continue;
    }

    const custRows = await dbSelect<Customer>("customers", `id=eq.${run.customer_id}&limit=1`);
    const customer = custRows[0];

    // Envoi réel (WhatsApp/email) + log. On avance l'étape quoi qu'il arrive
    // (le retry sur échec est du ressort de la Phase 6).
    const outcome = customer ? await dispatchStep(run, step, customer) : "skipped";
    if (outcome === "sent") sent++;

    // Avance l'étape.
    const nextStep = run.current_step + 1;
    if (nextStep < steps.length) {
      await dbPatch("sequence_runs", `id=eq.${run.id}`, {
        current_step: nextStep,
        next_due_at: dueAtFromNow(steps[nextStep].delay_hours ?? 0),
      });
    } else {
      await dbPatch("sequence_runs", `id=eq.${run.id}`, {
        current_step: nextStep,
        status: "sent",
        next_due_at: null,
      });
      finished++;
    }
  }

  return { processed: runs.length, sent, deferred, finished };
}
