import 'server-only';
import { randomUUID } from 'node:crypto';
import { getPayrollPeriod, commitPayrollPeriod, getPayrollConfig } from '@/lib/dao/payrollDao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { createNotification } from '@/lib/dao/notificationsDao';
import { createPayrollAdminNotifications } from './payrollNotifications';
import { sendWhatsAppDocument, sendWhatsAppMessage } from '@/lib/services/whatsappClient';
import { generatePayrollPdf } from '@/lib/pdf/generatePayrollPdf';
import { profilePhone } from '@/lib/payroll/sources';
import { recapMessage, isPaid, PayrollError, type PayrollDelivery } from '@/lib/payroll/model';

export async function sendPayrollBatch(periodId: string, profileIds: string[], kind: 'RECAP' | 'SLIP' | 'REMINDER', actor: string | null, resend = false) {
  const results: { profileId: string; status: string; error?: string }[] = [];
  for (const profileId of [...new Set(profileIds)]) {
    try { results.push({ profileId, status: await sendOne(periodId, profileId, kind, actor, resend) }); }
    catch (e) { results.push({ profileId, status: 'FAILED', error: e instanceof Error ? e.message : 'Pengiriman gagal.' }); }
  }
  return results;
}
async function sendOne(periodId: string, profileId: string, kind: 'RECAP' | 'SLIP' | 'REMINDER', actor: string | null, resend: boolean) {
  const record = await getPayrollPeriod(periodId);
  if (!record) throw new PayrollError('Periode tidak ditemukan.', 404);
  const p = record.document;
  const slip = p.slips.find(s => s.profile_id === profileId);
  if (!slip) throw new PayrollError('Penerima tidak ditemukan.');
  if (kind === 'SLIP' && (p.status !== 'FINAL' || !isPaid(p, profileId))) throw new PayrollError('Slip harus final dan sudah ditransfer sebelum dikirim.');
  if (kind !== 'SLIP' && !p.calculated_at) throw new PayrollError('Hitung ulang rekap terlebih dahulu.');
  const key = `${profileId}:${kind === 'SLIP' ? p.version : 'period'}:${kind}`;
  const previous = p.deliveries[key];
  if (previous?.status === 'SENDING') throw new PayrollError('Pengiriman sedang berlangsung. Jangan mengulang.');
  if (previous && ['SENT', 'LMS_ONLY', 'SIMULATED'].includes(previous.status) && !resend) return previous.status;
  const token = randomUUID();
  const delivery: PayrollDelivery = { token, profile_id: profileId, kind, version: p.version, status: 'SENDING', at: new Date().toISOString() };
  const claimed = { ...p, deliveries: { ...p.deliveries, [key]: delivery } };
  await commitPayrollPeriod(record, claimed, actor, 'DELIVERY_CLAIM', `${kind} ${profileId}`);
  let status: PayrollDelivery['status'] = 'FAILED'; let failure = ''; let channel = '';
  try {
    const config = await getPayrollConfig();
    const profile = config.people.find(s => s.id === profileId);
    if (!profile) throw new PayrollError('Profil penerima tidak ditemukan.');
    const user = profile.kind === 'COACH' && profile.user_id ? await getSupabaseAdmin().from('users').select('id,role,is_active,parent_contact_phone').eq('id', profile.user_id).maybeSingle() : null;
    if (profile.kind === 'COACH' && (!user?.data || user.data.role !== 'COACH' || !user.data.is_active)) throw new PayrollError('Akun coach tidak aktif/tidak tersedia.');
    const phone = profilePhone(profile, user?.data);
    const message = kind === 'SLIP'
      ? `Slip gaji ${p.id} versi ${p.version}\nHalo ${slip.name}, admin telah mencatat penyelesaian transfer periode ini. Slip PDF terlampir dan tersedia di akun LMS. Hubungi admin jika ada pertanyaan.`
      : `${kind === 'REMINDER' ? 'PENGINGAT TERAKHIR — ' : ''}${recapMessage(p, slip)}`;
    if (profile.user_id) await createNotification(profile.user_id, kind === 'SLIP' ? `Slip gaji ${p.id}` : `Deadline koreksi absensi ${p.id}: tanggal 25 pukul 17.00 WIB`, message, 'PAYROLL', {
      actionUrl: `/coach/payroll?period=${p.id}`, category: 'PAYROLL', priority: 'HIGH', push: true, dedupeKey: `payroll:${p.id}:${key}`,
    });
    if (!phone) {
      if (profile.user_id) { status = 'LMS_ONLY'; channel = 'LMS'; }
      else { status = 'NO_CONTACT'; channel = 'ADMIN'; await createPayrollAdminNotifications({ title: 'Slip staf belum dapat dikirim', message: `Nomor WhatsApp ${slip.name} belum diisi. Slip ${p.id} tersedia untuk diunduh admin.`, type: 'PAYROLL', actionUrl: `/admin/payroll?period=${p.id}`, dedupeKey: `payroll-no-contact:${p.id}:${key}` }); }
    } else {
      // Only private phone numbers are accepted; the existing sender also supports
      // groups, which must never be used for salary documents.
      if (!/^\+?[0-9 ()-]{8,25}$/.test(phone)) throw new PayrollError('Nomor WA profil tidak valid. Perbaiki profil sebelum mengirim ulang.');
      const pdf = kind === 'SLIP' ? await generatePayrollPdf(p, slip) : null;
      if (process.env.NODE_ENV !== 'production' && process.env.PAYROLL_LOCAL_PREVIEW === 'true') {
        // Only paid slips render a PDF. Recaps/reminders are text without money.
        // Local preview never initializes WhatsApp or claims real delivery.
        status = 'SIMULATED'; channel = 'LOCAL_PREVIEW';
      } else {
        if (pdf) {
          const result = await sendWhatsAppDocument({ phoneNumber: phone, document: pdf, mimeType: 'application/pdf', fileName: `Slip-Gaji-${p.id}-v${p.version}.pdf`, caption: message });
          if (!result.success) throw new PayrollError(result.error || 'WhatsApp gagal mengirim slip.');
        } else {
          // Keep long attendance lists complete while staying below WA limits.
          const chunks: string[] = []; let part = '';
          for (const line of message.split('\n')) {
            if (part && part.length + line.length > 12000) { chunks.push(part); part = ''; }
            part += (part ? '\n' : '') + line;
          }
          if (part) chunks.push(part);
          for (const [index, chunk] of chunks.entries()) {
            const result = await sendWhatsAppMessage(phone, chunks.length > 1 ? `REKAP ABSENSI ${p.id} (${index + 1}/${chunks.length})\n${chunk}` : chunk);
            if (!result.success) throw new PayrollError(result.error || 'WhatsApp gagal mengirim rekap.');
          }
        }
        status = 'SENT'; channel = 'WHATSAPP';
      }
    }
  } catch (e) { failure = e instanceof Error ? e.message : 'Pengiriman gagal.'; }
  const latest = await getPayrollPeriod(periodId);
  if (!latest || latest.document.deliveries[key]?.token !== token) throw new PayrollError('Status pengiriman berubah. Periksa log sebelum mengirim ulang.', 409);
  const next = structuredClone(latest.document);
  next.deliveries[key] = { ...delivery, status, channel, error: failure || undefined, at: new Date().toISOString() };
  await commitPayrollPeriod(latest, next, actor, 'DELIVERY_RESULT', `${kind} ${status}`);
  if (failure) throw new PayrollError(failure);
  return status;
}
