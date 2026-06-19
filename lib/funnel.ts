// Logique métier FunnelBoss : mapping Chariow → Insforge, upserts idempotents,
// mise en file des séquences, règles d'arrêt, et moteur (sendMessage MOCK en
// Phase 3 — les envois réels Wasender/Brevo arrivent en Phase 4).

import { dbSelect, dbUpsert, dbInsert, dbPatch } from "./insforge";

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
}): Promise<void> {
  await dbUpsert("sales", [args], "chariow_sale_id");
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
  const msgs = await dbSelect(
    "message_logs",
    `sequence_run_id=in.(${ids})&sent_at=gte.${utcMidnightISO()}&limit=1`,
  );
  return msgs.length > 0;
}

/** MOCK Phase 3 : log l'envoi dans message_logs (pas d'appel provider réel). */
async function sendMessageMock(
  run: Run,
  step: Step,
  recipient: string,
  status = "mock_sent",
): Promise<void> {
  await dbInsert("message_logs", [{
    sequence_run_id: run.id,
    channel: step.channel,
    recipient,
    template_key: step.template_key,
    provider_status: status,
    provider_message_id: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    raw_response: { mock: true },
  }]);
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
    const recipient = step.channel === "email" ? customer?.email : customer?.whatsapp;

    if (recipient) {
      await sendMessageMock(run, step, recipient);
      sent++;
    } else {
      // Pas de coordonnée pour ce canal : on log et on avance quand même.
      await sendMessageMock(run, step, "", "skipped_no_recipient");
    }

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
