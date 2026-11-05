import 'server-only';
import * as dao from '@/lib/dao/payrollDao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { buildPayrollActivities, type SessionSource, type ClassSource, type EnrollmentSource, type LeaveSource, type TrialSource, type AssessmentSource } from '@/lib/payroll/sources';
import { calculatePeriod, createPeriod, currentPeriod, effective, inPeriod, PayrollError, wibDate, type PeriodRecord, type PeriodDocument } from '@/lib/payroll/model';
import { approvedRequestActivities, type ActivityRequest } from '@/lib/payroll/activityRequests';
import { attendanceAdmins } from './payrollNotifications';
import { payrollLegacyBaseline } from './payrollLegacyBaseline';

export async function calculatePayroll(record: PeriodRecord, now = new Date(), actor: string | null = null): Promise<PeriodRecord> {
  requireDraft(record);
  const config = await dao.getPayrollConfig();
  if (!config.settings.active_from) throw new PayrollError('Atur tanggal mulai pencatatan gaji terlebih dahulu.');
  if (config.people.filter(p => p.active).length === 0) throw new PayrollError('Tambahkan coach/staf dan kontraknya terlebih dahulu.');
  const [sessions, trials, assessments, requests] = await Promise.all([
    dao.payrollRows('sessions', 'id,class_id,date_time,status,substitute_coach_id,payroll_mode', { gte: ['date_time', record.document.starts_at], lt: ['date_time', record.document.ends_at] }),
    dao.payrollRows('trial_class_submissions', 'id,student_name,phone,trial_mode,status,coach_id,scheduled_at,duration_minutes'),
    dao.payrollRows('trial_assessments', 'id,trial_id,coach_id,status,submitted_at,invoice_id,payment_confirmed_at,coder_id'),
    dao.payrollRows('payroll_activity_requests', '*', { gte: ['activity_at', record.document.starts_at], lt: ['activity_at', record.document.ends_at] }),
  ]);
  const classIds = [...new Set(sessions.map(s => s.class_id as string))];
  const invoiceIds = [...new Set(assessments.map(a => a.invoice_id as string).filter(Boolean))];
  const [classes, enrollments, leaves, invoices] = await Promise.all([
    dao.payrollRows('classes', 'id,name,type,coach_id,delivery_mode,payroll_mode', { in: ['id', classIds] }),
    dao.payrollRows('enrollments', 'id,class_id,coder_id,enrolled_at,ended_at,status', { in: ['class_id', classIds] }),
    dao.payrollRows('coach_leave_requests', 'id,session_id,status,substitute_coach_id', { in: ['session_id', sessions.map(s => s.id as string)] }),
    dao.payrollRows('invoices', 'id,status', { in: ['id', invoiceIds] }),
  ]);
  const built = buildPayrollActivities({ period: record.document, sessions: sessions as unknown as SessionSource[], classes: classes as unknown as ClassSource[], enrollments: enrollments as unknown as EnrollmentSource[], leaves: leaves as unknown as LeaveSource[], trials: trials as unknown as TrialSource[], assessments: assessments as unknown as AssessmentSource[], invoices: invoices as { id: string; status: string }[], now });
  const active = [...built.activities, ...approvedRequestActivities(requests as unknown as ActivityRequest[])].filter(a => wibDate(a.date) >= config.settings.active_from!);
  for (const a of active) {
    const override = record.document.overrides[a.key];
    const profile = override?.profile_id ? config.people.find(p => p.id === override.profile_id) : config.people.find(p => p.user_id === a.user_id);
    const term = profile && effective(config.terms.filter(t => t.profile_id === profile.id), wibDate(a.date));
    if (term?.contract === 'FULLTIME' && a.details?.includes('Mode belum ditetapkan admin') && !override?.mode && override?.amount === undefined && !override?.excluded && !a.cancelled) {
      built.warnings.push(`Pilih mode fulltime/mitra untuk ${a.label} (${wibDate(a.date)}) atau beri override beralasan.`);
    }
  }
  const next = calculatePeriod({ period: record.document, people: config.people, terms: config.terms, cards: config.cards, activities: active, sourceWarnings: built.warnings, now });
  const eligiblePics = await attendanceAdmins();
  if (!eligiblePics.some(a => a.id === next.pic_id)) next.pic_id = eligiblePics.find(a => a.id === actor)?.id ?? eligiblePics[0]?.id ?? null;
  return dao.commitPayrollPeriod(record, next, actor, 'CALCULATE');
}

export async function payrollBootstrap(year?: number, month?: number) {
  const [config, periods, coaches, classes] = await Promise.all([
    dao.getPayrollConfig(), dao.listPayrollPeriods(),
    getSupabaseAdmin().from('users').select('id,full_name,username,parent_contact_phone,is_active').eq('role', 'COACH').order('full_name'),
    getSupabaseAdmin().from('classes').select('id,name,coach_id,type,delivery_mode,payroll_mode').order('name'),
  ]);
  if (coaches.error || classes.error) throw new PayrollError('Gagal membaca profil coach/kelas.', 500);
  let selected = year && month ? periods.find(p => p.id === `${year}-${String(month).padStart(2, '0')}`) : undefined;
  if (!selected && !year) selected = periods[0];
  const requestPeriod = selected?.document ?? (year && month ? createPeriod(year, month) : currentPeriod());
  const requests = await dao.payrollRows('payroll_activity_requests', '*', { gte: ['activity_at', requestPeriod.starts_at], lt: ['activity_at', requestPeriod.ends_at] });
  return { ...config, legacyBaseline: await payrollLegacyBaseline(requestPeriod.id), admins: await attendanceAdmins(), requests: requests as unknown as ActivityRequest[], periods: periods.map(p => ({ id: p.id, status: p.document.status, version: p.document.version })), selected: selected ?? null, coaches: coaches.data ?? [], classes: classes.data ?? [], audit: selected ? await dao.getPayrollAudit(selected.id) : [] };
}

export function requireDraft(record: PeriodRecord) {
  if (record.document.status !== 'DRAFT') throw new PayrollError('Buka revisi beralasan untuk mengubah periode final.', 409);
  if (Object.values(record.document.deliveries).some(d => d.status === 'SENDING')) throw new PayrollError('Ada pengiriman berlangsung.', 409);
}
export function requireReason(reason: string) {
  if (reason.trim().length < 5) throw new PayrollError('Alasan minimal 5 karakter wajib diisi.');
}
export function assertComponentDate(date: string, document: PeriodDocument) {
  if (!inPeriod(date, document)) throw new PayrollError('Tanggal aktivitas harus berada dalam periode yang dipilih.');
}
export { currentPeriod };
