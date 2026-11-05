import 'server-only';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getPayrollConfig, ensurePayrollPeriod } from '@/lib/dao/payrollDao';
import { correctionOpen, currentPeriod, PayrollError, wibDate } from '@/lib/payroll/model';
import { createAttendanceAdminNotifications } from './payrollNotifications';
import { createNotification } from '@/lib/dao/notificationsDao';
import type { ActivityRequest } from '@/lib/payroll/activityRequests';

const submission = z.object({ id: z.string().uuid(), activityAt: z.string().datetime({ offset: true }), kind: z.enum(['EVENT','OBSERVATION_ONLINE','OBSERVATION_OFFLINE','TRAINING_ONLINE','TRAINING_OFFLINE']), label: z.string().trim().min(3).max(160), notes: z.string().trim().min(10).max(2000) });
export async function submitActivityRequest(raw: unknown, coachId: string, now = new Date()) {
  if (raw && typeof raw === 'object' && 'kind' in raw && raw.kind === 'TRIAL') throw new PayrollError('Absensi trial dicatat otomatis setelah coach yang ditugaskan mengirim penilaian trial. Gunakan modul Trial, bukan pengajuan aktivitas tambahan.');
  const parsed = submission.safeParse(raw);
  if (!parsed.success) throw new PayrollError('Isi jenis, tanggal/jam WIB, nama kegiatan (min. 3 karakter), dan rincian (min. 10 karakter).');
  const input = parsed.data, period = currentPeriod(new Date(input.activityAt));
  if (Date.parse(input.activityAt) > now.getTime()) throw new PayrollError('Ajukan hanya kegiatan yang sudah berlangsung.');
  if (!correctionOpen(period, now)) throw new PayrollError('Batas pengajuan tanggal 25 pukul 17.00 WIB telah lewat.');
  const config = await getPayrollConfig();
  if (!config.settings.active_from || wibDate(input.activityAt) < config.settings.active_from) throw new PayrollError('Kegiatan berada sebelum tanggal mulai pencatatan gaji.');
  if (!config.people.some(p => p.active && p.kind === 'COACH' && p.user_id === coachId)) throw new PayrollError('Profil penggajian coach belum diaktifkan admin.');
  const db = getSupabaseAdmin();
  const { error } = await db.from('payroll_activity_requests' as never).insert({ id: input.id, coach_id: coachId, activity_at: input.activityAt, kind: input.kind, label: input.label, notes: input.notes } as never);
  if (error?.code === '23505') throw new PayrollError('Kegiatan yang sama sudah diajukan. Periksa riwayat pengajuan.', 409);
  if (error) throw new PayrollError('Gagal menyimpan pengajuan kegiatan.', 500);
  // The authoritative request remains saved if an optional notification fails.
  await createAttendanceAdminNotifications({ title: 'Pengajuan aktivitas coach', message: `${config.people.find(p => p.user_id === coachId)?.name}: ${input.label}. Periksa untuk menyetujui atau menolak.`, actionUrl: `/admin/coach-attendance?period=${period.id}`, dedupeKey: `payroll-request:${input.id}`, push: process.env.PAYROLL_LOCAL_PREVIEW !== 'true' }).catch(e => console.error('[Payroll activity notification]', e));
  return { success: true, id: input.id };
}
export async function reviewActivityRequest(input: { id: string; requestRevision: number; status: 'APPROVED' | 'REJECTED'; mode: 'MITRA' | 'FULLTIME'; reason: string }, actor: string) {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('payroll_activity_requests' as never).select('*').eq('id', input.id).maybeSingle();
  if (error || !data) throw new PayrollError('Pengajuan tidak ditemukan.', 404);
  const request = data as unknown as ActivityRequest;
  const period = currentPeriod(new Date(request.activity_at));
  await ensurePayrollPeriod(period.year, period.month);
  const result = await db.rpc('payroll_review_activity' as never, { p_id: input.id, p_expected_revision: input.requestRevision, p_status: input.status, p_mode: input.mode, p_reason: input.reason, p_period_id: period.id, p_actor_id: actor } as never);
  if (result.error) throw new PayrollError(result.error.code === '40001' ? 'Pengajuan sudah berubah. Muat ulang.' : 'Periode harus draft dan tidak sedang mengirim. Buka revisi admin jika periode sudah final.', 409);
  await createNotification(request.coach_id, input.status === 'APPROVED' ? 'Aktivitas disetujui admin' : 'Aktivitas ditolak admin', `${request.label}: ${input.reason}`, 'PAYROLL', { actionUrl: `/coach/payroll?period=${period.id}`, dedupeKey: `payroll-request-review:${request.id}:${input.requestRevision + 1}`, push: true }).catch(e => console.error('[Payroll review notification]', e));
  return { success: true };
}
