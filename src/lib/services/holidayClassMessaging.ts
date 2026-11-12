import 'server-only';

import { getInvoiceById } from '@/lib/dao/invoicesDao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { holidayInvoiceUrl } from './holidayClassPayment';
import { trialAdminWhatsAppGroup } from './trialClassNotifications';
import type { Invoice } from '@/lib/types/invoice';

type MessageKind = 'registration_group' | 'invoice_parent' | 'paid_group' | 'paid_parent';
type OutboxRow = { id: number; registration_id: string; kind: MessageKind; attempts: number; claimed_at: string };
type Registration = {
  invoice_id: string;
  platform: 'none' | 'own' | 'clevio';
  selections: Array<{ name: string; batch: string; time: string }>;
};

export function holidayWhatsAppMessage(kind: MessageKind, invoice: Invoice, registration: Registration) {
  const paid = kind === 'paid_group' || kind === 'paid_parent';
  const group = kind === 'registration_group' || kind === 'paid_group';
  const header = paid ? '*Holiday Class · Pembayaran diterima*' : group
    ? '*Holiday Class · Pendaftaran baru*' : '*Invoice Holiday Class Clevio*';
  const detail = [
    `Peserta: ${invoice.seasonal_student_name}`,
    `Invoice: ${invoice.invoice_number}`,
    `Total: Rp${invoice.total_amount.toLocaleString('id-ID')}`,
    `Status: ${paid ? 'Lunas' : 'Menunggu pembayaran'}`,
    '',
    ...registration.selections.map(choice => `• ${choice.name} · ${choice.batch} · ${choice.time} WIB`),
    ...(registration.platform === 'none' ? [] : [`Open Code: ${registration.platform === 'clevio' ? 'Beli lewat Clevio' : 'Disiapkan sendiri'}`]),
  ];
  const footer = group
    ? [`Wali: ${invoice.parent_name}`, `Follow up: https://wa.me/${invoice.parent_phone}`]
    : [`${paid ? 'Lihat invoice lunas' : 'Buka invoice dan bayar via Midtrans'}: ${holidayInvoiceUrl(invoice)}`];
  return [header, '', ...detail, '', ...footer].join('\n');
}

export async function deliverHolidayWhatsApp(registrationId: string | null = null) {
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc('claim_holiday_class_whatsapp' as never, { p_registration: registrationId } as never);
  if (error) throw new Error('Holiday WhatsApp claim failed');
  const rows = (data ?? []) as OutboxRow[];
  if (!rows.length) return { sent: 0, deferred: 0 };
  const { sendWhatsAppMessage } = await import('./whatsappClient');
  let sent = 0;
  for (const row of rows) {
    let success = false;
    let permanentFailure = false;
    try {
      const { data: record, error: lookupError } = await db.from('holiday_class_registrations' as never)
        .select('invoice_id,platform,selections').eq('id', row.registration_id).single();
      if (lookupError || !record) throw new Error('Holiday WhatsApp registration lookup failed');
      const registration = record as Registration;
      const invoice = await getInvoiceById(registration.invoice_id);
      if (!invoice) throw new Error('Holiday WhatsApp invoice lookup failed');
      const group = row.kind === 'registration_group' || row.kind === 'paid_group';
      const target = group ? trialAdminWhatsAppGroup() : invoice.parent_phone;
      const result = await sendWhatsAppMessage(target, holidayWhatsAppMessage(row.kind, invoice, registration));
      success = result.success;
      permanentFailure = /not on WhatsApp|Invalid WhatsApp target/i.test(result.error ?? '');
    } catch {
      console.warn('[Holiday Class] WhatsApp delivery deferred', { event: row.id });
    }
    const now = new Date();
    const terminal = permanentFailure || row.attempts >= 8;
    const delay = Math.min(60, 2 ** row.attempts);
    const { error: saveError } = await db.from('holiday_class_whatsapp_outbox' as never)
      .update({
        claimed_at: null,
        sent_at: success ? now.toISOString() : null,
        failed_at: !success && terminal ? now.toISOString() : null,
        next_attempt_at: new Date(now.getTime() + delay * 60_000).toISOString(),
      } as never).eq('id', row.id).eq('claimed_at', row.claimed_at);
    if (saveError) console.error('[Holiday Class] WhatsApp delivery result unavailable', { event: row.id });
    if (success) sent += 1;
  }
  return { sent, deferred: rows.length - sent };
}
