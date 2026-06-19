// Webhook Chariow (Pulses). PUSH temps réel.
// Sécurité : Chariow ne signe pas ses Pulses → l'URL est protégée par un token
// secret en query (?token=CHARIOW_WEBHOOK_SECRET), vérifié ici.
// Idempotence : chariow_sale_id UNIQUE empêche tout double-traitement.

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import {
  upsertCustomer,
  upsertSale,
  enqueueByTrigger,
  stopAbandonRunsForCustomer,
} from "@/lib/funnel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // 0. Rate-limit anti-abus (60 req / 60 s / IP).
  if (!(await rateLimit(`chariow:${clientIp(req.headers)}`, 60, 60))) {
    return NextResponse.json({ ok: false, error: "rate limited" }, { status: 429 });
  }

  // 1. Token (à défaut de signature côté Chariow).
  if (req.nextUrl.searchParams.get("token") !== env.chariowWebhookSecret()) {
    return NextResponse.json({ ok: false, error: "invalid token" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const event: string | undefined = payload?.event;

  try {
    if (event === "successful.sale") {
      const customer = await upsertCustomer(payload.customer);
      await upsertSale({
        chariow_sale_id: payload.sale.id,
        customer_id: customer.id,
        product_ref: payload?.product?.id ?? null,
        amount: payload?.sale?.amount?.value ?? null,
        status: "successful",
        occurred_at: payload?.sale?.completed_at ?? payload?.sale?.created_at ?? null,
        checkout_url: payload?.checkout?.url ?? null,
      });
      // Conversion : on stoppe net les relances d'abandon en cours.
      await stopAbandonRunsForCustomer(customer.id);
      // Puis on enclenche la séquence post-achat.
      await enqueueByTrigger(customer.id, "successful_sale");
      return NextResponse.json({ ok: true, event });
    }

    if (event === "abandoned.sale") {
      const hasCustomer = !!payload?.customer?.id;
      const customer = hasCustomer ? await upsertCustomer(payload.customer) : null;
      await upsertSale({
        chariow_sale_id: payload.sale.id,
        customer_id: customer?.id ?? null,
        product_ref: payload?.product?.id ?? null,
        amount: payload?.sale?.amount?.value ?? null,
        status: "abandoned",
        occurred_at: payload?.sale?.abandoned_at ?? payload?.sale?.created_at ?? null,
        checkout_url: payload?.checkout?.url ?? null,
      });
      // Relance seulement si on a un contact.
      if (customer) await enqueueByTrigger(customer.id, "abandoned_sale");
      return NextResponse.json({ ok: true, event, enqueued: !!customer });
    }

    // Autres events (failed.sale, license.*, affiliate.*) : ack sans traitement.
    return NextResponse.json({ ok: true, ignored: event ?? null });
  } catch (e) {
    // Échec de traitement → 500 pour déclencher le retry Chariow (idempotent).
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
