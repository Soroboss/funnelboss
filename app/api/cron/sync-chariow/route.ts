// PULL — filet de rattrapage. Pagine customers/products/sales chez Chariow et
// upsert dans Insforge (idempotent). Déclenché périodiquement (toutes les 6 h).
// Protégé par CRON_SECRET (Authorization: Bearer ...).

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { chariowListAll } from "@/lib/chariow";
import {
  upsertCustomer,
  upsertProduct,
  upsertSale,
  findCustomerIdByChariow,
  mapSaleStatus,
} from "@/lib/funnel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  return req.headers.get("authorization") === `Bearer ${env.cronSecret()}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const [customers, products, sales] = await Promise.all([
      chariowListAll("/customers"),
      chariowListAll("/products"),
      chariowListAll("/sales"),
    ]);

    for (const c of customers) await upsertCustomer(c);
    for (const p of products) await upsertProduct(p);

    let salesUpserted = 0;
    for (const s of sales) {
      const status = mapSaleStatus(s?.status);
      if (!status) continue; // on ignore les statuts hors périmètre (ex: failed)

      let customerId: string | null = null;
      if (s?.customer?.id) {
        const cu = await upsertCustomer(s.customer);
        customerId = cu.id;
      } else if (s?.customer_id) {
        customerId = await findCustomerIdByChariow(s.customer_id);
      }

      await upsertSale({
        chariow_sale_id: s.id,
        customer_id: customerId,
        product_ref: s?.product?.id ?? null,
        amount: s?.amount?.value ?? null,
        status,
        occurred_at: s?.completed_at ?? s?.abandoned_at ?? s?.created_at ?? null,
        checkout_url: s?.checkout?.url ?? null,
      });
      salesUpserted++;
    }

    return NextResponse.json({
      ok: true,
      customers: customers.length,
      products: products.length,
      sales: salesUpserted,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
