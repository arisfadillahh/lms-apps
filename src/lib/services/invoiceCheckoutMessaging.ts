import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { checkoutPreview, getCheckoutLink, isInvoiceCheckoutEnabled, type CheckoutLink, CheckoutError } from '@/lib/services/invoiceCheckoutServer';

/** One claimed send per link/day; transport ambiguity is not automatically retried. */
export async function sendCheckoutMessage(link: CheckoutLink, expectedHash?: string) {
  const preview = await checkoutPreview(link);
  if (expectedHash && expectedHash !== preview.previewHash) throw new CheckoutError('Rincian tagihan/pesan berubah. Buka preview terbaru sebelum mengirim.');
  const { data, error } = await getSupabaseAdmin().rpc('claim_invoice_checkout_message' as never, { p_link: link.id } as never);
  if (error) throw new CheckoutError('Status pengiriman tidak dapat dikunci.', 503);
  if (data !== true) return { success: true, skipped: true };
  const { sendWhatsAppMessage } = await import('@/lib/services/whatsappClient');
  let success = false;
  try { success = (await sendWhatsAppMessage(link.parent_phone, preview.message)).success; } catch { /* no automatic retry */ }
  const { error: finishError } = await getSupabaseAdmin().from('invoice_checkout_links' as any)
    .update({ send_state: success ? 'SENT' : 'UNCERTAIN', sent_at: success ? new Date().toISOString() : null }).eq('id', link.id).eq('send_state', 'SENDING');
  if (finishError || !success) throw new CheckoutError('Pengiriman belum dapat dipastikan. Periksa WhatsApp sebelum mengirim ulang.', 502);
  return { success: true, skipped: false };
}

export async function sendCheckoutPaidConfirmation(orderId: string) {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('invoice_checkout_intents' as any).update({ confirmation_state: 'SENDING' })
    .eq('order_id', orderId).eq('state', 'PAID').eq('confirmation_state', 'UNSENT').select('order_id');
  if (error || !data?.length) return;
  let success = false;
  try {
    const { intentInvoiceIds } = await import('@/lib/services/invoiceCheckoutServer');
    const { getInvoiceById } = await import('@/lib/dao/invoicesDao');
    const invoices = (await Promise.all((await intentInvoiceIds(orderId)).map(getInvoiceById))).filter(i => i !== null);
    if (!invoices.length) throw new Error('Missing paid invoices');
    const { sendWhatsAppMessage } = await import('@/lib/services/whatsappClient');
    const message = ['*Pembayaran Clevio terkonfirmasi*', '', 'Terima kasih, pembayaran untuk tagihan berikut telah diterima:',
      ...invoices.map(i => `• ${i.invoice_number}: Rp${i.total_amount.toLocaleString('id-ID')}`), '',
      'Status tagihan sudah diperbarui. Silakan buka kembali link pembayaran untuk melihat tagihan yang masih belum lunas.'].join('\n');
    success = (await sendWhatsAppMessage(invoices[0].parent_phone, message)).success;
  } catch { /* Notification failure never changes a committed settlement. */ }
  await db.from('invoice_checkout_intents' as any).update({ confirmation_state: success ? 'SENT' : 'UNCERTAIN' }).eq('order_id', orderId).eq('confirmation_state', 'SENDING');
}

export async function sendGroupedReminderForInvoice(invoiceId: string) {
  if (!isInvoiceCheckoutEnabled()) return null;
  const { data, error } = await getSupabaseAdmin().from('invoice_checkout_links' as any).select('id')
    .contains('invoice_ids', [invoiceId]).in('send_state', ['SENT', 'SENDING', 'UNCERTAIN']).order('created_at', { ascending: false }).limit(1);
  if (error) throw new CheckoutError('Link tagihan pilihan tidak dapat diperiksa.', 503);
  if (!data?.length) return null;
  const link = await getCheckoutLink((data[0] as unknown as { id: string }).id);
  if (!link) return null;
  if (link.send_state !== 'SENT') return { success: true, skipped: true };
  return sendCheckoutMessage(link);
}
