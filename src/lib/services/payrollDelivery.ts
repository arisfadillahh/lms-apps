import 'server-only';
import { randomUUID } from 'node:crypto';
import { getPayrollPeriod, commitPayrollPeriod, getPayrollConfig } from '@/lib/dao/payrollDao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { createNotification } from '@/lib/dao/notificationsDao';
import { createPayrollAdminNotifications } from './payrollNotifications';
import { sendWhatsAppDocument, sendWhatsAppMessage } from '@/lib/services/whatsappClient';
import { generatePayrollPdf } from '@/lib/pdf/generatePayrollPdf';
import { profilePhone } from '@/lib/payroll/sources';
import { attendanceRecapBlockReason, formatCoachRecapNotice, formatStaffRecap } from '@/lib/payroll/attendanceMessage';
import { isPaid, PayrollError, wibDate, type PayrollDelivery } from '@/lib/payroll/model';
import { createReimbursementLink } from './payrollReimbursements';
import { reimbursementDeadline, reimbursementIsOpen } from '@/lib/payroll/reimbursementDeadline';

export async function sendPayrollBatch(periodId: string, profileIds: string[], kind: PayrollDelivery['kind'], actor: string | null, resend = false) {
  const results: { profileId: string; status: string; error?: string }[] = [];
  for (const profileId of [...new Set(profileIds)]) {
    try { results.push({ profileId, status: await sendOne(periodId, profileId, kind, actor, resend) }); }
    catch (e) { results.push({ profileId, status: 'FAILED', error: e instanceof Error ? e.message : 'Pengiriman gagal.' }); }
  }
  return results;
}
async function sendOne(periodId: string, profileId: string, kind: PayrollDelivery['kind'], actor: string | null, resend: boolean) {
  const record = await getPayrollPeriod(periodId);
  if (!record) throw new PayrollError('Periode tidak ditemukan.', 404);
  const p = record.document;
  const config = await getPayrollConfig();
  const profile = config.people.find(s => s.id === profileId);
  if (!profile) throw new PayrollError('Profil penerima tidak ditemukan.');
  const staffRecap = kind === 'RECAP' && actor !== null && profile.kind === 'STAFF';
  const slip = p.slips.find(s => s.profile_id === profileId) ?? (kind === 'REIMBURSEMENT' || staffRecap ? { profile_id: profile.id, user_id: profile.user_id, name: profile.name, job_title: profile.job_title, kind: profile.kind, contract: 'MITRA' as const, lines: [], total: 0 } : undefined);
  if (!slip) throw new PayrollError('Penerima tidak ditemukan.');
  if (kind === 'SLIP' && actor === null) throw new PayrollError('Slip hanya dapat dikirim oleh admin atau finance setelah transfer.');
  if (kind === 'SLIP' && (p.status !== 'FINAL' || !isPaid(p, profileId))) throw new PayrollError('Slip harus final dan sudah ditransfer sebelum dikirim.');
  if (['RECAP','REMINDER'].includes(kind) && !p.calculated_at) throw new PayrollError('Hitung ulang rekap terlebih dahulu.');
  const automatic = actor === null && kind !== 'SLIP';
  // Manual retries must not consume the scheduled coach message on the 25th.
  // Keep scheduled keys stable for existing cron records and slip keys unchanged.
  const baseKey = `${profileId}:${kind === 'SLIP' ? p.version : 'period'}:${kind}`;
  const key = `${baseKey}${actor !== null && kind !== 'SLIP' ? ':MANUAL' : ''}`;
  const previous = p.deliveries[key];
  const pendingKeys = kind === 'SLIP' ? [baseKey] : [baseKey, `${baseKey}:MANUAL`];
  if (pendingKeys.some(k => p.deliveries[k]?.status === 'SENDING')) throw new PayrollError('Pengiriman sedang berlangsung. Jangan mengulang.');
  const scheduledFrom = Date.parse(p.correction_deadline) - (kind === 'REMINDER' ? 1 : 8) * 3600000;
  const legacyEarlyMessage = automatic && previous && Date.now() >= scheduledFrom && Date.parse(previous.at) < scheduledFrom;
  if (previous && ['SENT', 'LMS_ONLY', 'SIMULATED'].includes(previous.status) && !resend && !legacyEarlyMessage) return previous.status;
  if (automatic) {
    const now = new Date();
    if (!config.settings.automation_enabled || !config.settings.active_from || config.settings.active_from > wibDate(now)) throw new PayrollError('Otomasi rekap belum diaktifkan admin.');
    if (now.getTime() < scheduledFrom || now.getTime() >= Date.parse(p.correction_deadline)) throw new PayrollError('Rekap otomatis hanya dikirim tanggal 25 pukul 09.00–17.00 WIB; pengingat mulai pukul 16.00 WIB.');
  }
  const now = new Date();
  if (kind === 'REIMBURSEMENT' && (!profile.active || !reimbursementIsOpen(p, profile.id, now))) throw new PayrollError('Pengajuan reimbursement sudah ditutup atau penerima tidak aktif.');
  if (staffRecap && !profile.active) throw new PayrollError('Rekap hanya dikirim ke penerima aktif.');
  if (!staffRecap && (kind === 'RECAP' || kind === 'REMINDER')) {
    if (profile.kind !== 'COACH' || slip.kind !== 'COACH' || !profile.active) throw new PayrollError('Rekap absensi hanya dikirim ke coach aktif.');
    const incomplete = automatic && kind === 'RECAP' ? attendanceRecapBlockReason(slip) : null;
    if (incomplete) {
      const details = incomplete.replace(/^Rekap belum dapat dikirim: /, '');
      await createPayrollAdminNotifications({ title: 'Detail rekap mengajar belum lengkap', message: `${slip.name} · ${p.id}, ${details}`, type: 'PAYROLL', actionUrl: `/admin/payroll?period=${p.id}`, dedupeKey: `payroll-attendance-incomplete:${p.id}:${profileId}` })
        .catch(error => console.error('[Payroll] Gagal membuat notifikasi detail rekap', error));
    }
  }
  const token = randomUUID();
  const delivery: PayrollDelivery = { token, profile_id: profileId, kind, version: p.version, status: 'SENDING', at: new Date().toISOString() };
  const claimed = { ...p, deliveries: { ...p.deliveries, [key]: delivery } };
  await commitPayrollPeriod(record, claimed, actor, 'DELIVERY_CLAIM', `${kind} ${profileId}`);
  let status: PayrollDelivery['status'] = 'FAILED'; let failure = ''; let channel = '';
  try {
    const user = profile.kind === 'COACH' && profile.user_id ? await getSupabaseAdmin().from('users').select('id,role,is_active,parent_contact_phone').eq('id', profile.user_id).maybeSingle() : null;
    if (profile.kind === 'COACH' && (!user?.data || user.data.role !== 'COACH' || !user.data.is_active)) throw new PayrollError('Akun coach tidak aktif/tidak tersedia.');
    const phone = profilePhone(profile, user?.data);
    // The configured site URL is trusted; never use request/forwarded host headers.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
    const reimbursementUrl = kind !== 'SLIP' && reimbursementIsOpen(p, profile.id, now)
      ? createReimbursementLink(p, profile.id, appUrl || '', now) : '';
    const deadline = new Date(reimbursementDeadline(p, profile.id)).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const reimbursementText = reimbursementUrl ? `\n\nAda reimbursement? Isi judul, nominal, dan foto bukti di sini:\n${reimbursementUrl}\nPaling lambat tanggal 25 pukul ${deadline} WIB. Pengajuan diperiksa Admin/Finance.` : '';
    const message = kind === 'SLIP'
      ? `Slip gaji ${p.id} versi ${p.version}\nHalo ${slip.name}, admin telah mencatat penyelesaian transfer periode ini. Slip PDF terlampir dan tersedia di akun LMS. Hubungi admin jika ada pertanyaan.`
      : kind === 'REIMBURSEMENT' ? `Pengajuan reimbursement · ${new Date(Date.UTC(p.year,p.month-1,1)).toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'Asia/Jakarta'})}\nHalo ${slip.name}.${reimbursementText}`
      : staffRecap ? formatStaffRecap(p, slip)
      : formatCoachRecapNotice(p, slip.name, now, appUrl, kind === 'REMINDER')
        + (reimbursementUrl ? `\nReimbursement: ${reimbursementUrl}` : '');
    if (profile.user_id) await createNotification(profile.user_id, kind === 'SLIP' ? `Slip gaji ${p.id}` : kind === 'REIMBURSEMENT' ? `Pengajuan reimbursement ${p.id}` : `Rekap absensi ${p.id}`, message, 'PAYROLL', {
      actionUrl: kind === 'REIMBURSEMENT' ? reimbursementUrl : `/coach/payroll?period=${p.id}`, category: 'PAYROLL', priority: 'HIGH', push: true, dedupeKey: `payroll:${p.id}:${key}${automatic ? ':AUTOMATIC' : ''}`,
    });
    if (!phone) {
      if (profile.user_id) { status = 'LMS_ONLY'; channel = 'LMS'; }
      else { status = 'NO_CONTACT'; channel = 'ADMIN'; await createPayrollAdminNotifications({ title: staffRecap ? 'Rekap staf belum dapat dikirim' : kind === 'REIMBURSEMENT' ? 'Form reimbursement staf belum dapat dikirim' : 'Slip staf belum dapat dikirim', message: `Nomor WhatsApp ${slip.name} belum diisi. Lengkapi nomor di profil penerima periode ${p.id}.`, type: 'PAYROLL', actionUrl: `/admin/payroll?period=${p.id}`, dedupeKey: `payroll-no-contact:${p.id}:${key}` }); }
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
            const result = await sendWhatsAppMessage(phone, chunks.length > 1 ? `Rekap mengajar (${index + 1}/${chunks.length})\n${chunk}` : chunk);
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
