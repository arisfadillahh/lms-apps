import 'server-only';

import { getInvoiceById } from '@/lib/dao/invoicesDao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { holidayInvoiceUrl } from './holidayClassPayment';
import { trialAdminWhatsAppGroup } from './trialClassNotifications';
import type { Invoice } from '@/lib/types/invoice';
import { holidayReminderAllowed } from '@/lib/holidayReminders';

type MessageKind = 'registration_group' | 'invoice_parent' | 'paid_group' | 'paid_parent' | 'reminder_1' | 'reminder_3';
type OutboxRow = { id: number; registration_id: string; kind: MessageKind; attempts: number; claimed_at: string };
type Registration = {
  invoice_id: string;
  platform: 'none' | 'own' | 'clevio';
  selections: Array<{ name: string; batch: string; time: string }>;
};

export function holidayWhatsAppMessage(kind: MessageKind, invoice: Invoice, registration: Registration) {
  if (kind.startsWith('reminder_')) return [
    'Halo Ayah/Bunda, pendaftaran Holiday Class ' + invoice.seasonal_student_name + ' masih menunggu pembayaran.',
    ...registration.selections.map(s => `${s.name} · ${s.batch} · ${s.time} WIB`),
    `Invoice ${invoice.invoice_number}: ${holidayInvoiceUrl(invoice)}`,
    'Balas pesan ini kalau butuh bantuan memilih cara bayar.',
  ].join('\n\n');
  const paid = kind === 'paid_group' || kind === 'paid_parent' || invoice.status === 'PAID';
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
    ? [`Orang tua: ${invoice.parent_name}`, `Follow up: https://wa.me/${invoice.parent_phone}`]
    : [`${paid ? 'Lihat invoice lunas' : 'Lanjutkan pembayaran di sini'}: ${holidayInvoiceUrl(invoice)}`];
  const greeting=group?[]:paid
    ? [`Halo Ayah/Bunda, terima kasih. Pembayaran kelas ${invoice.seasonal_student_name} sudah kami terima.`]
    : [`Halo Ayah/Bunda, terima kasih sudah memilih Holiday Class Clevio untuk ${invoice.seasonal_student_name}.`,
      'Pendaftarannya sudah tercatat. Yuk, selesaikan pembayaran agar keikutsertaan ananda segera terkonfirmasi dan persiapan kelasnya bisa kami bantu.',
      `Mohon selesaikan paling lambat ${new Date(invoice.due_date).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric'})}.`];
  return [header, '', ...greeting, '', ...detail, '', ...footer,...(!group&&!paid?['','Kalau perlu bantuan memilih cara bayar, Ayah/Bunda boleh langsung balas pesan ini. Kami siap bantu.']:[])].join('\n');
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
    let lastError: string | null = null;
    try {
      const { data: record, error: lookupError } = await db.from('holiday_class_registrations' as never)
        .select('invoice_id,platform,selections').eq('id', row.registration_id).single();
      if (lookupError || !record) throw new Error('Holiday WhatsApp registration lookup failed');
      const registration = record as Registration;
      const invoice = await getInvoiceById(registration.invoice_id);
      if (!invoice) throw new Error('Holiday WhatsApp invoice lookup failed');
      if (row.kind.startsWith('reminder_')) {
        const eligibility=holidayReminderAllowed(invoice,new Date());
        if (process.env.HOLIDAY_REMINDER_ENABLED !== 'true' || !eligibility.withinHours) {
          const {error:deferError}=await db.from('holiday_class_whatsapp_outbox' as never).update({ claimed_at: null, attempts:Math.max(0,row.attempts-1),next_attempt_at: new Date(Date.now()+60*60_000).toISOString() } as never).eq('id',row.id).eq('claimed_at',row.claimed_at);
          if(deferError)throw new Error('Reminder deferral unavailable');
          continue;
        }
        if (!eligibility.active) {
          permanentFailure = true;
          throw new Error('Reminder stopped: paid, cancelled or invoice validity ended');
        }
      }
      const group = row.kind === 'registration_group' || row.kind === 'paid_group';
      const target = group ? trialAdminWhatsAppGroup() : invoice.parent_phone;
      const result = await sendWhatsAppMessage(target, holidayWhatsAppMessage(row.kind, invoice, registration));
      success = result.success;
      lastError = result.error?.replace(/https?:\/\/\S+/g, '[url]').replace(/\d{8,}/g,'[number]').slice(0, 500) ?? (success ? null : 'WhatsApp send failed without detail');
      permanentFailure = /not on WhatsApp|Invalid WhatsApp target/i.test(result.error ?? '');
    } catch (error) {
      lastError = error instanceof Error ? error.message.slice(0,500) : 'WhatsApp delivery failed';
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
        last_error: lastError,
      } as never).eq('id', row.id).eq('claimed_at', row.claimed_at);
    if (saveError) console.error('[Holiday Class] WhatsApp delivery result unavailable', { event: row.id });
    if (success) sent += 1;
  }
  return { sent, deferred: rows.length - sent };
}
