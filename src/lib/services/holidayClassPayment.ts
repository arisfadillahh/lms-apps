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

export async function settleHolidayPayment(payload: MidtransNotificationPayload, invoice?: Invoice, expectedTotal?: number) {
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
  if (invoice && (!holidayInvoicePattern.test(invoice.invoice_number) || !Number.isSafeInteger(expectedTotal)
    || amount !== expectedTotal || amount < invoice.total_amount)) {
    throw new Error('Holiday invoice payment amount mismatch');
  }
  const rawPaidAt = getMidtransPaidAt(authoritative).replace(' ', 'T');
  const paidAt = new Date(/T\d\d:\d\d:\d\d(?:\.\d+)?$/.test(rawPaidAt) ? rawPaidAt + '+07:00' : rawPaidAt);
  if (!Number.isFinite(paidAt.getTime())) throw new Error('Invalid Holiday Midtrans settlement date');
  const { data, error } = await getSupabaseAdmin().rpc('settle_holiday_class_invoice' as never, {
    p_order: invoice?.invoice_number ?? order, p_amount: invoice?.total_amount ?? amount, p_paid_at: paidAt.toISOString(),
  } as never);
  if (error || typeof data !== 'string') throw new Error('Holiday invoice settlement failed');
  return data;
}
