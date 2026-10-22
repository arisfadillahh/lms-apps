import 'server-only';

import { createHmac, timingSafeEqual, randomUUID, createHash } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getInvoiceById, getInvoiceSettings } from '@/lib/dao/invoicesDao';
import { InvoiceMidtransClient, mapMidtransStatus, getMidtransPaidAt, type InvoiceMidtransPayment, type MidtransNotificationPayload } from '@/lib/invoiceMidtransClient';
import { buildInvoicePaymentBreakdown, getPublicInvoicePaymentOptions } from '@/lib/invoicePaymentMethods';
import { getHistoricalInvoicePayments, updateStoredInvoicePaymentStatus } from '@/lib/invoicePaymentStore';
import { sanitizeMidtransNotificationPayload } from '@/lib/midtransWebhookSecurity';
import { normalizedParentPhone, sortCheckoutInvoices, validateCheckoutInvoices, formatCheckoutMessage, toCheckoutInvoice } from '@/lib/invoiceCheckout';
import type { Invoice } from '@/lib/types/invoice';

export interface CheckoutLink {
  id: string; invoice_ids: string[]; ccr_id: string; parent_phone: string;
  send_state: 'DRAFT' | 'SENDING' | 'SENT' | 'UNCERTAIN'; sent_at: string | null;
}
export interface CheckoutIntent {
  order_id: string; link_id: string | null; state: 'CREATING' | 'PENDING' | 'PAID' | 'CANCELLED' | 'REVIEW';
  method: string; base_amount: number; admin_fee: number; total_amount: number;
  payment_details: InvoiceMidtransPayment['paymentDetails'] | null;
}
export class CheckoutError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export function isInvoiceCheckoutEnabled() { return process.env.LMS_SELECTED_INVOICE_CHECKOUT_ENABLED === 'true'; }
export function requireInvoiceCheckoutEnabled() {
  if (!isInvoiceCheckoutEnabled()) throw new CheckoutError('Pembayaran tagihan pilihan belum diaktifkan. Gunakan link invoice biasa atau hubungi admin.', 503);
}

function secret() {
  const value = process.env.INVOICE_PUBLIC_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) throw new CheckoutError('Konfigurasi link pembayaran belum tersedia.', 503);
  return value;
}
export function checkoutToken(link: CheckoutLink) {
  return createHmac('sha256', secret()).update(JSON.stringify(['checkout-v1', link.id, link.ccr_id, link.parent_phone, [...link.invoice_ids].sort()])).digest('base64url');
}
export function verifyCheckoutToken(link: CheckoutLink, token: string | null | undefined) {
  if (!token || token.length > 100) return false;
  const expected = Buffer.from(checkoutToken(link)), given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
export function checkoutUrl(link: CheckoutLink) {
  const base = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://lms.clev.io';
  return `${base.replace(/\/+$/, '')}/invoice/checkout/${link.id}?t=${checkoutToken(link)}`;
}

async function rpc<T>(name: string, input: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabaseAdmin().rpc(name as never, input as never);
  if (error) {
    console.error('[InvoiceCheckout] Database operation failed', { operation: name, code: error.code });
    throw new CheckoutError('Tagihan berubah, memiliki instruksi aktif, atau memerlukan pemeriksaan admin. Muat ulang sebelum melanjutkan.');
  }
  return data as T;
}

export async function getCheckoutLink(id: string): Promise<CheckoutLink | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await getSupabaseAdmin().from('invoice_checkout_links' as any).select('*').eq('id', id).maybeSingle();
  if (error) throw new CheckoutError('Penyimpanan tagihan pilihan belum tersedia.', 503);
  return data as unknown as CheckoutLink | null;
}
export async function loadCheckoutInvoices(link: CheckoutLink): Promise<Invoice[]> {
  const invoices = await Promise.all(link.invoice_ids.map(getInvoiceById));
  if (invoices.some(i => !i)) throw new CheckoutError('Daftar tagihan berubah. Minta link terbaru kepada admin.', 404);
  const valid = invoices as Invoice[];
  validateCheckoutInvoices(valid, true);
  if (valid.some(i => i.ccr_id !== link.ccr_id || normalizedParentPhone(i.parent_phone) !== normalizedParentPhone(link.parent_phone))) {
    throw new CheckoutError('Identitas tagihan berubah. Minta link terbaru kepada admin.', 404);
  }
  return sortCheckoutInvoices(valid);
}
export async function authorizeCheckout(id: string, token?: string | null) {
  const link = await getCheckoutLink(id);
  if (!link || !verifyCheckoutToken(link, token)) throw new CheckoutError('Link pembayaran tidak valid.', 404);
  return { link, invoices: await loadCheckoutInvoices(link) };
}
export async function createCheckoutLink(ids: string[], adminId: string) {
  requireInvoiceCheckoutEnabled();
  const invoices = await Promise.all(ids.map(getInvoiceById));
  if (invoices.some(i => !i)) throw new CheckoutError('Invoice tidak ditemukan.', 404);
  validateCheckoutInvoices(invoices as Invoice[]);
  const id = await rpc<string>('create_invoice_checkout_link', { p_ids: ids, p_admin: adminId });
  const link = await getCheckoutLink(id);
  if (!link) throw new CheckoutError('Gagal membuat link pembayaran.', 503);
  return link;
}

export async function getCheckoutIntent(orderId: string): Promise<CheckoutIntent | null> {
  const { data, error } = await getSupabaseAdmin().from('invoice_checkout_intents' as any).select('*').eq('order_id', orderId).maybeSingle();
  if (error) throw new CheckoutError('Status transaksi belum tersedia.', 503);
  return data as unknown as CheckoutIntent | null;
}
export async function getClaimedIntents(ids: string[]): Promise<CheckoutIntent[]> {
  if (!ids.length) return [];
  const { data, error } = await getSupabaseAdmin().from('invoice_checkout_claims' as any).select('order_id').in('invoice_id', ids);
  if (error) throw new CheckoutError('Reservasi pembayaran belum tersedia.', 503);
  const orders = [...new Set((data as unknown as Array<{ order_id: string }>).map(c => c.order_id))];
  return (await Promise.all(orders.map(getCheckoutIntent))).filter((i): i is CheckoutIntent => i !== null);
}
export async function intentInvoiceIds(orderId: string): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin().from('invoice_checkout_allocations' as any).select('invoice_id').eq('order_id', orderId);
  if (error) throw new CheckoutError('Rincian transaksi belum tersedia.', 503);
  return (data as unknown as Array<{ invoice_id: string }>).map(a => a.invoice_id);
}

export function assertProviderAmount(intent: Pick<CheckoutIntent, 'order_id' | 'total_amount'>, payload: MidtransNotificationPayload) {
  if (payload.order_id !== intent.order_id || !/^\d+(\.0{1,2})?$/.test(String(payload.gross_amount))
    || Number(payload.gross_amount) !== intent.total_amount) throw new CheckoutError('Nominal/status gateway berbeda. Pemeriksaan admin diperlukan.');
}
export async function finishCheckoutFromProvider(intent: CheckoutIntent, payload: MidtransNotificationPayload) {
  assertProviderAmount(intent, payload);
  const status = mapMidtransStatus(payload);
  const outcome = status === 'paid' ? 'PAID' : ['expired', 'cancelled'].includes(status) ? 'CANCELLED' : 'PENDING';
  const result = await rpc<{ state: CheckoutIntent['state']; duplicate?: boolean }>('finish_invoice_checkout', {
    p_order: intent.order_id, p_outcome: outcome, p_total: intent.total_amount,
    p_paid_at: outcome === 'PAID' ? getMidtransPaidAt(payload) : null,
  });
  // Compatibility snapshot only; the transactional ledger is authoritative.
  if (result.state !== 'REVIEW') await updateStoredInvoicePaymentStatus(intent.order_id, sanitizeMidtransNotificationPayload(payload), outcome === 'PAID' ? getMidtransPaidAt(payload) : null).catch(() => {
    console.warn('[InvoiceCheckout] Legacy payment snapshot refresh deferred');
  });
  return result;
}

/** Do not assume an older file/order was invalidated when a newer order was made. */
async function assertNoLegacyPayableOrders(invoices: Invoice[]) {
  const orders = new Map<string, number>();
  for (const old of await getHistoricalInvoicePayments(invoices.map(i => i.id))) {
    if (!old.orderId.startsWith('LMSB-')) orders.set(old.orderId, old.total);
  }
  const { data, error } = await getSupabaseAdmin().from('invoice_payment_attempts' as any).select('order_id,total_amount').in('invoice_id', invoices.map(i => i.id));
  // The historic optional metadata migration may not exist. Other errors fail closed.
  if (error && !['42P01', 'PGRST205'].includes(error.code)) throw new CheckoutError('Riwayat pembayaran database belum dapat diperiksa.', 503);
  for (const old of (data ?? []) as unknown as Array<{ order_id: string; total_amount: number }>) {
    if (!old.order_id.startsWith('LMSB-')) orders.set(old.order_id, old.total_amount);
  }
  for (const invoice of invoices) if (invoice.midtrans_order_id && !invoice.midtrans_order_id.startsWith('LMSB-')) {
    orders.set(invoice.midtrans_order_id, invoice.payment_total_amount ?? invoice.total_amount);
  }
  const client = new InvoiceMidtransClient();
  for (const [order_id, total_amount] of orders) {
    const status = await client.getTransactionStatus(order_id);
    assertProviderAmount({ order_id, total_amount }, status);
    if (!['expired', 'cancelled'].includes(mapMidtransStatus(status))) {
      throw new CheckoutError('Ada instruksi pembayaran lama yang masih aktif atau sedang dikonfirmasi. Gunakan invoice tersebut terlebih dahulu atau minta admin memeriksanya.');
    }
  }
}

export async function createCheckoutPayment(invoices: Invoice[], linkId: string | null, method: string, expectedBase: number) {
  requireInvoiceCheckoutEnabled();
  validateCheckoutInvoices(invoices);
  const base = invoices.reduce((sum, i) => sum + i.total_amount, 0);
  const breakdown = buildInvoicePaymentBreakdown(method, base);
  if (!breakdown) throw new CheckoutError('Metode pembayaran tidak tersedia.', 400);
  if (base !== expectedBase) throw new CheckoutError('Total tagihan berubah. Muat ulang dan periksa kembali pilihan.');
  const ids = invoices.map(i => i.id);
  const active = await getClaimedIntents(ids);
  if (active.length) {
    const intent = active[0], allocated = await intentInvoiceIds(intent.order_id);
    if (active.length === 1 && intent.method === method && allocated.length === ids.length && ids.every(id => allocated.includes(id)) && intent.link_id === linkId) return intent;
    throw new CheckoutError('Sudah ada instruksi aktif. Batalkan dan pastikan statusnya selesai sebelum mengubah pilihan.');
  }
  await assertNoLegacyPayableOrders(invoices);
  const orderId = `LMSB-${randomUUID()}`;
  await rpc('reserve_invoice_checkout', { p_order: orderId, p_link: linkId, p_ids: ids, p_method: method, p_base: base, p_fee: breakdown.adminFee });
  // Reservation commits BEFORE external charge. Any network ambiguity retains the
  // claim: never free it on timeout/404 and accidentally issue a second charge.
  try {
    const synthetic: Invoice = { ...invoices[0], id: orderId, invoice_number: `TAGIHAN-${invoices.length}`, total_amount: base, items: invoices.flatMap(i => i.items ?? []) };
    const payment = await new InvoiceMidtransClient().createPayment(synthetic, breakdown, orderId);
    assertProviderAmount({ order_id: orderId, total_amount: breakdown.total }, payment.rawResponse);
    const { error } = await getSupabaseAdmin().from('invoice_checkout_intents' as any).update({ state: 'PENDING', payment_details: payment.paymentDetails }).eq('order_id', orderId).eq('state', 'CREATING');
    if (error) throw new Error('Unable to save provider instructions');
    const intent = await getCheckoutIntent(orderId);
    if (!intent) throw new Error('Missing payment intent');
    return intent;
  } catch {
    throw new CheckoutError('Instruksi sedang dibuat atau perlu rekonsiliasi. Jangan membuat pembayaran baru; tekan Periksa status atau hubungi admin.', 503);
  }
}

export async function refreshCheckoutIntent(intent: CheckoutIntent, cancel = false) {
  const client = new InvoiceMidtransClient();
  let status = await client.getTransactionStatus(intent.order_id);
  assertProviderAmount(intent, status);
  if (cancel && mapMidtransStatus(status) === 'waiting_payment') {
    await client.cancelTransaction(intent.order_id);
    // A cancel response alone is not enough: verify final state (settlement may win).
    status = await client.getTransactionStatus(intent.order_id);
  }
  return finishCheckoutFromProvider(intent, status);
}

/** Admin/Core manually confirms received funds, but uses the same atomic grants.
 * Do not run the legacy "old period + duration" extender on v2-generated bills.
 */
export async function confirmManualMonthlyPayment(invoice: Invoice, paidAt: string, notes?: string) {
  requireInvoiceCheckoutEnabled();
  if (invoice.status === 'PAID') return { invoice, duplicate: true };
  if (!Number.isFinite(new Date(paidAt).getTime())) throw new CheckoutError('Tanggal pembayaran tidak valid.', 400);
  validateCheckoutInvoices([invoice]);
  if ((await getClaimedIntents([invoice.id])).length) throw new CheckoutError('Masih ada instruksi gateway aktif. Periksa/batalkan instruksi tersebut sebelum konfirmasi manual.');
  await assertNoLegacyPayableOrders([invoice]);
  const order = `LMSB-MANUAL-${randomUUID()}`;
  await rpc('reserve_invoice_checkout', { p_order: order, p_link: null, p_ids: [invoice.id], p_method: 'manual', p_base: invoice.total_amount, p_fee: 0 });
  if (notes?.trim()) {
    const { error } = await getSupabaseAdmin().from('invoice_checkout_intents' as any).update({ confirmation_notes: notes.trim().slice(0, 2000) }).eq('order_id', order);
    if (error) throw new CheckoutError('Catatan konfirmasi belum tersimpan. Periksa transaksi sebelum mengulangi.', 503);
  }
  const result = await rpc<{ state: string; duplicate: boolean }>('finish_invoice_checkout', { p_order: order, p_outcome: 'PAID', p_total: invoice.total_amount, p_paid_at: paidAt });
  if (result.state !== 'PAID') throw new CheckoutError('Konfirmasi ditahan untuk rekonsiliasi periode. Jangan mengulangi atau menagih ulang.');
  const paid = await getInvoiceById(invoice.id);
  if (!paid) throw new CheckoutError('Status pembayaran belum dapat dibaca kembali.', 503);
  return { invoice: paid, duplicate: result.duplicate };
}

export function publicCheckoutIntent(intent: CheckoutIntent, linkId: string, token: string) {
  const p = intent.payment_details;
  return {
    orderId: intent.order_id, state: intent.state, total: intent.total_amount, adminFee: intent.admin_fee,
    payment: p && intent.state === 'PENDING' ? {
      method: p.method, label: p.label, baseAmount: p.baseAmount, adminFee: p.adminFee, total: p.total, feeLabel: p.feeLabel,
      bank: p.bank, vaNumber: p.vaNumber, billerCode: p.billerCode, billKey: p.billKey,
      // Never expose raw provider payload, API credentials, or unauthenticated QR URLs.
      qrImageUrl: p.method === 'qris' ? `/api/invoice-checkouts/${linkId}/qr?t=${encodeURIComponent(token)}&order=${encodeURIComponent(intent.order_id)}` : null,
    } : null,
  };
}
export async function checkoutPreview(link: CheckoutLink) {
  const invoices = await loadCheckoutInvoices(link), settings = await getInvoiceSettings();
  const message = formatCheckoutMessage(invoices, invoices[0].parent_name, checkoutUrl(link), settings?.selected_invoices_message_template);
  return { url: checkoutUrl(link), message, previewHash: createHash('sha256').update(message).digest('hex'), sendState: link.send_state };
}
export async function publicCheckoutData(link: CheckoutLink, invoices: Invoice[], token: string) {
  const active = await getClaimedIntents(invoices.map(i => i.id));
  return {
    invoices: invoices.map(toCheckoutInvoice), options: getPublicInvoicePaymentOptions(0),
    active: await Promise.all(active.filter(i => i.link_id === link.id).map(async i => ({ ...publicCheckoutIntent(i, link.id, token), invoiceIds: await intentInvoiceIds(i.order_id) }))),
    hasOtherActive: active.some(i => i.link_id !== link.id), enabled: isInvoiceCheckoutEnabled(),
  };
}
