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
