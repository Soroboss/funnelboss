// Analytics & pilotage (Phase 5). Tout est calculé en JS à partir des lignes
// (volume boutique modeste). FCFA partout.

import { dbSelect } from "./insforge";
import { enqueueSequence } from "./funnel";

export const VIP_MIN_FCFA = 50000;
export const DORMANT_DAYS = 60;

export const SEGMENTS = ["vip", "dormant", "mono_produit", "actif", "prospect"] as const;
export type Segment = (typeof SEGMENTS)[number];

type Customer = {
  id: string;
  chariow_id: string;
  email: string | null;
  whatsapp: string | null;
  full_name: string | null;
  created_at: string;
};
type Sale = { customer_id: string | null; amount: string | number | null; occurred_at: string | null };
type Run = { id: string; customer_id: string; sequence_id: string; status: string };
type Sequence = { id: string; name: string; trigger: string; is_active: boolean };

type CustStats = { total: number; count: number; last: string | null };

function statsByCustomer(sales: Sale[]): Map<string, CustStats> {
  const m = new Map<string, CustStats>();
  for (const s of sales) {
    if (!s.customer_id) continue;
    const cur = m.get(s.customer_id) ?? { total: 0, count: 0, last: null };
    cur.total += Number(s.amount ?? 0);
    cur.count += 1;
    if (s.occurred_at && (!cur.last || s.occurred_at > cur.last)) cur.last = s.occurred_at;
    m.set(s.customer_id, cur);
  }
  return m;
}

export function segmentsOf(st: CustStats | undefined): Segment[] {
  if (!st || st.count === 0) return ["prospect"];
  const segs: Segment[] = [];
  if (st.total >= VIP_MIN_FCFA) segs.push("vip");
  if (st.count === 1) segs.push("mono_produit");
  const dormant = !st.last || Date.now() - new Date(st.last).getTime() > DORMANT_DAYS * 86_400_000;
  segs.push(dormant ? "dormant" : "actif");
  return segs;
}

async function loadAll() {
  const [customers, sales, runs, sequences] = await Promise.all([
    dbSelect<Customer>("customers", "limit=1000&order=created_at.desc"),
    dbSelect<Sale>("sales", "status=eq.successful&limit=5000"),
    dbSelect<Run>("sequence_runs", "limit=5000"),
    dbSelect<Sequence>("sequences", "limit=100"),
  ]);
  return { customers, sales, runs, sequences };
}

export async function getKpis() {
  const [sales, runs] = await Promise.all([
    dbSelect<Sale>("sales", "status=eq.successful&limit=5000"),
    dbSelect<Run>("sequence_runs", "limit=5000"),
  ]);
  const convertedCustomers = new Set(
    runs.filter((r) => r.status === "converted").map((r) => r.customer_id),
  );
  const caAttribue = sales
    .filter((s) => s.customer_id && convertedCustomers.has(s.customer_id))
    .reduce((a, s) => a + Number(s.amount ?? 0), 0);
  const relancesActives = runs.filter((r) => r.status === "pending").length;
  const converted = runs.filter((r) => r.status === "converted").length;
  const tauxConversion = runs.length ? Math.round((converted / runs.length) * 100) : 0;
  return { caAttribue, relancesActives, tauxConversion, totalRuns: runs.length, converted };
}

export async function listCustomers(filter?: Segment, q?: string) {
  const { customers, sales } = await loadAll();
  const stats = statsByCustomer(sales);
  const ql = (q ?? "").trim().toLowerCase();

  return customers
    .map((c) => {
      const st = stats.get(c.id);
      return {
        id: c.id,
        chariow_id: c.chariow_id,
        full_name: c.full_name,
        email: c.email,
        whatsapp: c.whatsapp,
        total_spent: st?.total ?? 0,
        purchases: st?.count ?? 0,
        last_purchase_at: st?.last ?? null,
        segments: segmentsOf(st),
      };
    })
    .filter((c) => (filter ? c.segments.includes(filter) : true))
    .filter((c) =>
      ql
        ? [c.full_name, c.email, c.whatsapp, c.chariow_id]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(ql))
        : true,
    );
}

export async function getSequenceStats() {
  const { runs, sequences } = await loadAll();
  return sequences.map((seq) => {
    const rs = runs.filter((r) => r.sequence_id === seq.id);
    const by = (s: string) => rs.filter((r) => r.status === s).length;
    const converted = by("converted");
    return {
      id: seq.id,
      name: seq.name,
      trigger: seq.trigger,
      is_active: seq.is_active,
      total: rs.length,
      pending: by("pending"),
      sent: by("sent"),
      stopped: by("stopped"),
      converted,
      tauxConversion: rs.length ? Math.round((converted / rs.length) * 100) : 0,
    };
  });
}

export async function getRecentLogs(limit = 50) {
  return dbSelect(
    "message_logs",
    `select=channel,recipient,template_key,provider_status,sent_at&order=sent_at.desc&limit=${limit}`,
  );
}

/** Lance la séquence de réactivation pour tous les clients d'un segment. */
export async function reactivateSegment(segment: Segment): Promise<{ matched: number; enqueued: number }> {
  const { customers, sales, sequences } = await loadAll();
  const stats = statsByCustomer(sales);
  const seq = sequences.find((s) => s.trigger === "manual_reactivation" && s.is_active);
  if (!seq) return { matched: 0, enqueued: 0 };

  const matches = customers.filter(
    (c) => segmentsOf(stats.get(c.id)).includes(segment) && (c.email || c.whatsapp),
  );

  let enqueued = 0;
  for (const c of matches) {
    // seq contient ses steps au runtime (renvoyés par PostgREST).
    const created = await enqueueSequence(c.id, seq as never);
    if (created) enqueued++;
  }
  return { matched: matches.length, enqueued };
}

/** Séries pour les graphiques : CA attribué / semaine (8 sem.) + envois par canal. */
export async function getOverviewSeries() {
  const [sales, runs, logs] = await Promise.all([
    dbSelect<Sale & { occurred_at: string | null }>("sales", "status=eq.successful&limit=5000"),
    dbSelect<Run>("sequence_runs", "limit=5000"),
    dbSelect<{ channel: string; provider_status: string }>(
      "message_logs",
      "select=channel,provider_status&limit=5000",
    ),
  ]);
  const conv = new Set(runs.filter((r) => r.status === "converted").map((r) => r.customer_id));

  const WEEKS = 8;
  const weekStart = (d: Date) => {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = (x.getUTCDay() + 6) % 7; // lundi = 0
    x.setUTCDate(x.getUTCDate() - day);
    return x;
  };
  const thisWeek = weekStart(new Date());
  const buckets: { label: string; start: number; ca: number }[] = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const s = new Date(thisWeek);
    s.setUTCDate(s.getUTCDate() - i * 7);
    buckets.push({ label: `${s.getUTCDate()}/${s.getUTCMonth() + 1}`, start: s.getTime(), ca: 0 });
  }
  for (const sale of sales) {
    if (!sale.customer_id || !conv.has(sale.customer_id) || !sale.occurred_at) continue;
    const t = new Date(sale.occurred_at).getTime();
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (t >= buckets[i].start) {
        buckets[i].ca += Number(sale.amount ?? 0);
        break;
      }
    }
  }

  const channels = { whatsapp: 0, email: 0 };
  for (const l of logs) {
    if (l.provider_status === "failed" || l.provider_status === "skipped_no_recipient") continue;
    if (l.channel === "whatsapp") channels.whatsapp++;
    else if (l.channel === "email") channels.email++;
  }

  return { weeks: buckets.map((b) => ({ label: b.label, ca: b.ca })), channels };
}

/** Fiche client détaillée : profil dérivé + ventes + runs + messages. */
export async function getCustomerDetail(id: string) {
  const [cust, sales, runs, seqs] = await Promise.all([
    dbSelect<Customer>("customers", `id=eq.${id}&limit=1`),
    dbSelect<Sale & { chariow_sale_id: string; status: string; product_ref: string | null }>(
      "sales",
      `customer_id=eq.${id}&order=occurred_at.desc.nullslast&limit=50`,
    ),
    dbSelect<Run & { sequence_id: string; created_at: string }>(
      "sequence_runs",
      `customer_id=eq.${id}&order=created_at.desc&limit=50`,
    ),
    dbSelect<Sequence>("sequences", "limit=100"),
  ]);
  const customer = cust[0];
  if (!customer) return null;

  const stats = statsByCustomer(sales as Sale[]).get(id);
  const runIds = runs.map((r) => r.id);
  const messages = runIds.length
    ? await dbSelect(
        "message_logs",
        `sequence_run_id=in.(${runIds.join(",")})&order=sent_at.desc&limit=50`,
      )
    : [];

  return {
    customer: {
      ...customer,
      total_spent: stats?.total ?? 0,
      purchases: stats?.count ?? 0,
      segments: segmentsOf(stats),
    },
    sales,
    runs: runs.map((r) => ({ ...r, sequence: seqs.find((s) => s.id === r.sequence_id)?.name ?? "—" })),
    messages,
  };
}
