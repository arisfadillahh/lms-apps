import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeCheckout, publicCheckoutData, createCheckoutPayment, getCheckoutIntent, intentInvoiceIds, refreshCheckoutIntent, CheckoutError } from '@/lib/services/invoiceCheckoutServer';
import { checkoutSelectedTotal } from '@/lib/invoiceCheckout';
import { sendCheckoutPaidConfirmation } from '@/lib/services/invoiceCheckoutMessaging';

type Params = { params: Promise<{ id: string }> };
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('pay'), token: z.string().max(100), invoiceIds: z.array(z.string().uuid()).min(1).max(24), method: z.string(), expectedBase: z.number().int().positive() }),
  z.object({ action: z.enum(['refresh', 'cancel']), token: z.string().max(100), orderId: z.string().max(100) }),
]);
function failure(e: unknown) { return NextResponse.json({ error: e instanceof CheckoutError ? e.message : 'Tagihan belum dapat diproses. Muat ulang atau hubungi admin.' }, { status: e instanceof CheckoutError ? e.status : 500 }); }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const token = request.nextUrl.searchParams.get('t');
    const { link, invoices } = await authorizeCheckout((await params).id, token);
    return NextResponse.json(await publicCheckoutData(link, invoices, token!), { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (e) { return failure(e); }
}
export async function POST(request: NextRequest, { params }: Params) {
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Permintaan pembayaran tidak valid.' }, { status: 400 });
  try {
    const body = parsed.data;
    const { link, invoices } = await authorizeCheckout((await params).id, body.token);
    if (body.action === 'pay') {
      let total: number;
      try { total = checkoutSelectedTotal(invoices.map(i => ({ ...i, periodLabel: '', coderNames: [] })), body.invoiceIds); }
      catch { throw new CheckoutError('Pilihan tagihan berubah atau sudah lunas. Muat ulang halaman.'); }
      if (body.expectedBase !== total) throw new CheckoutError('Total pilihan berubah. Muat ulang halaman.');
      await createCheckoutPayment(invoices.filter(i => body.invoiceIds.includes(i.id)), link.id, body.method, total);
    } else {
      const intent = await getCheckoutIntent(body.orderId);
      if (!intent || intent.link_id !== link.id) throw new CheckoutError('Transaksi tidak ditemukan.', 404);
      const members = await intentInvoiceIds(intent.order_id);
      if (!members.every(id => link.invoice_ids.includes(id))) throw new CheckoutError('Transaksi tidak ditemukan.', 404);
      const result = await refreshCheckoutIntent(intent, body.action === 'cancel');
      if (result.state === 'REVIEW') throw new CheckoutError('Pembayaran diterima tetapi periode perlu direkonsiliasi admin. Jangan membayar ulang.');
      if (result.state === 'PAID') await sendCheckoutPaidConfirmation(intent.order_id);
    }
    // Reload invoices after settlement; never return the pre-payment snapshot.
    const fresh = await authorizeCheckout(link.id, body.token);
    return NextResponse.json(await publicCheckoutData(link, fresh.invoices, body.token), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return failure(e); }
}
