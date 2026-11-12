import 'server-only';

import { getMidtransConfigUrls, getMidtransPaidAt, InvoiceMidtransClient, mapMidtransStatus, type MidtransNotificationPayload } from '@/lib/invoiceMidtransClient';
import { holidayInvoicePattern } from '@/lib/holidayClass';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { Invoice } from '@/lib/types/invoice';
import { buildInvoicePublicUrl } from '@/lib/services/invoicePublicAccess';

export function holidayInvoiceUrl(invoice: Invoice) {
  const { finishRedirectUrl } = getMidtransConfigUrls();
  // Use the explicit public invoice-number route.
  return buildInvoicePublicUrl(finishRedirectUrl, {
    invoice_number: invoice.invoice_number, parent_phone: invoice.parent_phone, total_amount: invoice.total_amount,
  });
}

type PaymentRecord = { id: string; payment_url: string | null; payment_claimed_at: string | null };
export async function getHolidayPaymentUrl(invoice: Invoice): Promise<string | null> {
  if (!holidayInvoicePattern.test(invoice.invoice_number) || !['PENDING', 'OVERDUE'].includes(invoice.status)) return null;
  const db = getSupabaseAdmin();
  const lookup = () => db.from('holiday_class_registrations' as never).select('id,payment_url,payment_claimed_at')
    .eq('invoice_id', invoice.id).maybeSingle();
  const { data, error } = await lookup();
  if (error || !data) throw new Error('Holiday payment registration unavailable');
  const record = data as PaymentRecord;
  if (record.payment_url) return record.payment_url;

  const claimedAt = new Date().toISOString();
  const staleBefore = new Date(Date.now() - 90_000).toISOString();
  const { data: claimed, error: claimError } = await db.from('holiday_class_registrations' as never)
    .update({ payment_claimed_at: claimedAt } as never).eq('id', record.id).is('payment_url', null)
    .or(`payment_claimed_at.is.null,payment_claimed_at.lt.${staleBefore}`).select('id').maybeSingle();
  if (claimError) throw new Error('Holiday payment claim failed');
  if (!claimed) {
    const current = await lookup();
    return (current.data as PaymentRecord | null)?.payment_url ?? null;
  }

  // The invoice code is always the same Midtrans order ID, including after a retry.
  const url = await createHolidaySnap(invoice);
  const { error: storeError } = await db.from('holiday_class_registrations' as never)
    .update({ payment_url: url, payment_claimed_at: null } as never).eq('id', record.id).eq('payment_claimed_at', claimedAt);
  if (storeError) throw new Error('Holiday payment URL persistence failed');
  return url;
}

async function createHolidaySnap(invoice: Invoice) {
  const key = process.env.MIDTRANS_SERVER_KEY?.trim();
  if (!key) throw new Error('Midtrans key unavailable');
  const midtrans = new InvoiceMidtransClient();
  const response = await fetch(`${midtrans.baseUrl}/snap/v1/transactions`, {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(key + ':').toString('base64')}`,
      'X-Override-Notification': getMidtransConfigUrls().paymentNotificationUrl,
    },
    body: JSON.stringify({
      transaction_details: { order_id: invoice.invoice_number, gross_amount: invoice.total_amount },
      customer_details: { first_name: invoice.parent_name, phone: invoice.parent_phone },
      item_details: [{ id: invoice.invoice_number, name: 'Clevio Holiday Class', price: invoice.total_amount, quantity: 1 }],
      callbacks: { finish: holidayInvoiceUrl(invoice), error: holidayInvoiceUrl(invoice) },
    }),
  });
  const payload = await response.json().catch(() => null) as { redirect_url?: string } | null;
  if (!response.ok || !payload?.redirect_url) throw new Error(`Midtrans hosted payment unavailable (HTTP ${response.status})`);
  const target = new URL(payload.redirect_url);
  if (target.origin !== midtrans.baseUrl || !target.pathname.startsWith('/snap/')) throw new Error('Invalid hosted payment URL');
  return target.href;
}

export async function settleHolidayPayment(payload: MidtransNotificationPayload) {
  // Check the provider status, since the webhook signature only signs order, code, and amount.
  const order = String(payload.order_id);
  const authoritative = await new InvoiceMidtransClient().getTransactionStatus(order);
  const amounts = [authoritative.gross_amount, payload.gross_amount].map(String);
  if (authoritative.order_id !== order || amounts.some(value => !/^\d+(?:\.0{1,2})?$/.test(value))
    || Number(amounts[0]) !== Number(amounts[1])) {
    throw new Error('Holiday Midtrans order or amount mismatch');
  }
  if (mapMidtransStatus(authoritative) !== 'paid') throw new Error('Holiday Midtrans settlement not yet confirmed');
  const amount = Number(authoritative.gross_amount);
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error('Invalid Holiday Midtrans settlement amount');
  const rawPaidAt = getMidtransPaidAt(authoritative).replace(' ', 'T');
  const paidAt = new Date(/T\d\d:\d\d:\d\d(?:\.\d+)?$/.test(rawPaidAt) ? rawPaidAt + '+07:00' : rawPaidAt);
  if (!Number.isFinite(paidAt.getTime())) throw new Error('Invalid Holiday Midtrans settlement date');
  const { data, error } = await getSupabaseAdmin().rpc('settle_holiday_class_invoice' as never, {
    p_order: order, p_amount: amount, p_paid_at: paidAt.toISOString(),
  } as never);
  if (error || typeof data !== 'string') throw new Error('Holiday invoice settlement failed');
  return data;
}
