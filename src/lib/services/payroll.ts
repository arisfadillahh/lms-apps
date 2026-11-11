import 'server-only';
import * as dao from '@/lib/dao/payrollDao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { buildPayrollActivities, type AttendanceSource, type SessionSource, type ClassSource, type EnrollmentSource, type LeaveSource, type TrialSource, type AssessmentSource } from '@/lib/payroll/sources';
import { calculatePeriod, createPeriod, currentPeriod, effective, inPeriod, PayrollError, wibDate, type Activity, type PeriodRecord, type PeriodDocument } from '@/lib/payroll/model';
import { approvedRequestActivities, type ActivityRequest } from '@/lib/payroll/activityRequests';
import { attendanceAdmins } from './payrollNotifications';
import { calculateSynchronizedPeriod } from '@/lib/payroll/synchronizedPeriod';
import { canonicalMeetingCandidates, meetingFromActivity } from '@/lib/payroll/attendanceDetails';
import { refreshAttendanceSource } from './payrollAttendanceSource';
import { applyAttendancePolicy, STUDENT_ATTENDANCE_FROM, usesLmsAttendanceForEntirePeriod } from '@/lib/payroll/attendancePolicy';

export async function calculatePayroll(record: PeriodRecord, now = new Date(), actor: string | null = null): Promise<PeriodRecord> {
  requireDraft(record);
  record={...record,document:applyAttendancePolicy(record.document,now)};
  const config = await dao.getPayrollConfig();
  if (record.document.legacy_imports?.length) {
    const sourced = await refreshAttendanceSource(record.document,now);
    const native = await payrollSourceActivities(sourced,now);
    const pastMeetings = await payrollMeetingCandidates(sourced, now,native.activities);
    const catalog = new Map((sourced.meeting_catalog ?? []).filter(m=>m.origin==='SOURCE' && (!sourced.class_attendance_from || Date.parse(m.date)<Date.parse(sourced.class_attendance_from))).map(m=>[m.key,m]));
    for(const m of pastMeetings)catalog.set(m.key,m);
    const isCurrent = record.id === currentPeriod(now).id || usesLmsAttendanceForEntirePeriod(sourced);
    if(isCurrent)for(const a of native.activities.filter(a=>['WEEKLY','EKSKUL'].includes(a.kind) && Date.parse(a.date)>=Date.parse(sourced.class_attendance_from!))){
      const override=sourced.overrides[a.key];
      const person=override?.profile_id?config.people.find(p=>p.id===override.profile_id):config.people.find(p=>p.user_id===a.user_id);
      const term=person && effective(config.terms.filter(t=>t.profile_id===person.id),wibDate(a.date));
      if(term?.contract==='FULLTIME' && a.fee_eligible!==false && a.details?.includes('Mode belum ditetapkan admin') && !override?.mode && override?.amount===undefined && !override?.excluded && !a.cancelled)native.warnings.push(`Pilih mode fulltime/mitra untuk ${a.label} (${wibDate(a.date)}) atau beri override beralasan.`);
    }
    const next = calculateSynchronizedPeriod({ period: { ...sourced, meeting_catalog: [...catalog.values()] }, ...config, activities:isCurrent ? native.activities : [], sourceWarnings:isCurrent ? native.warnings.filter(w=>w.startsWith('Tanggal konfirmasi lunas trial') || w.startsWith('Absensi siswa') || w.startsWith('Pilih mode fulltime')) : [], now, includeRecurring: isCurrent });
    return dao.commitPayrollPeriod(record, next, actor, 'CALCULATE');
  }
  if (!config.settings.active_from) throw new PayrollError('Atur tanggal mulai pencatatan gaji terlebih dahulu.');
  if (config.people.filter(p => p.active).length === 0) throw new PayrollError('Tambahkan coach/staf dan kontraknya terlebih dahulu.');
  const built = await payrollSourceActivities(record.document, now);
  const active = built.activities.filter(a => wibDate(a.date) >= config.settings.active_from!);
  for (const a of active) {
    const override = record.document.overrides[a.key];
    const profile = override?.profile_id ? config.people.find(p => p.id === override.profile_id) : config.people.find(p => p.user_id === a.user_id);
    const term = profile && effective(config.terms.filter(t => t.profile_id === profile.id), wibDate(a.date));
    if (term?.contract === 'FULLTIME' && a.fee_eligible!==false && a.details?.includes('Mode belum ditetapkan admin') && !override?.mode && override?.amount === undefined && !override?.excluded && !a.cancelled) built.warnings.push(`Pilih mode fulltime/mitra untuk ${a.label} (${wibDate(a.date)}) atau beri override beralasan.`);
  }
  const next = calculatePeriod({ period: record.document, people: config.people, terms: config.terms, cards: config.cards, activities: active, sourceWarnings: built.warnings, now });
  const eligiblePics = await attendanceAdmins();
  if (!eligiblePics.some(a => a.id === next.pic_id)) next.pic_id = eligiblePics.find(a => a.id === actor)?.id ?? eligiblePics[0]?.id ?? null;
  return dao.commitPayrollPeriod(record, next, actor, 'CALCULATE');
}

async function payrollSourceActivities(period: PeriodDocument, now: Date) {
  const [sessions, trials, assessments, requests] = await Promise.all([
    dao.payrollRows('sessions', 'id,class_id,date_time,status,substitute_coach_id,payroll_mode', { gte: ['date_time', period.starts_at], lt: ['date_time', period.ends_at] }),
    dao.payrollRows('trial_class_submissions', 'id,student_name,phone,trial_mode,status,coach_id,scheduled_at,duration_minutes'),
    dao.payrollRows('trial_assessments', 'id,trial_id,coach_id,status,submitted_at,invoice_id,payment_confirmed_at,coder_id'),
    dao.payrollRows('payroll_activity_requests', '*', { gte: ['activity_at', period.starts_at], lt: ['activity_at', period.ends_at] }),
  ]);
  const classIds = [...new Set(sessions.map(s => s.class_id as string))];
  const invoiceIds = [...new Set(assessments.map(a => a.invoice_id as string).filter(Boolean))];
  const [classes, enrollments, leaves, invoices, attendance] = await Promise.all([
    dao.payrollRows('classes', 'id,name,type,coach_id,delivery_mode,payroll_mode', { in: ['id', classIds] }),
    dao.payrollRows('enrollments', 'id,class_id,coder_id,enrolled_at,ended_at,status,users!inner()', { eq: ['users.is_active', 'true'], in: ['class_id', classIds] }),
    dao.payrollRows('coach_leave_requests', 'id,session_id,status,substitute_coach_id', { in: ['session_id', sessions.map(s => s.id as string)] }),
    dao.payrollRows('invoices', 'id,status', { in: ['id', invoiceIds] }),
    dao.payrollRows('attendance', 'session_id,coder_id,status', { in: ['session_id', sessions.map(s=>s.id as string)] }),
  ]);
  const built = buildPayrollActivities({ period, sessions: sessions as unknown as SessionSource[], classes: classes as unknown as ClassSource[], enrollments: enrollments as unknown as EnrollmentSource[], leaves: leaves as unknown as LeaveSource[], trials: trials as unknown as TrialSource[], assessments: assessments as unknown as AssessmentSource[], invoices: invoices as { id: string; status: string }[], attendance:attendance as unknown as AttendanceSource[], attendanceRequiredFrom:period.class_attendance_from ?? STUDENT_ATTENDANCE_FROM, now });
  return { activities: [...built.activities, ...approvedRequestActivities(requests as unknown as ActivityRequest[]).filter(a => inPeriod(a.date, period) && Date.parse(a.date) <= now.getTime())], warnings: built.warnings };
}

export async function payrollMeetingCandidates(period: PeriodDocument, now = new Date(), activities?:Activity[]) {
  const [built,config] = await Promise.all([activities ? Promise.resolve({activities}) : payrollSourceActivities(period, now),dao.getPayrollConfig()]);
  const catalog = new Map((period.meeting_catalog ?? []).filter(m=>m.origin!=='SOURCE' || !period.class_attendance_from || Date.parse(m.date)<Date.parse(period.class_attendance_from)).map(m => [m.key,m]));
  for (const a of built.activities.filter(a => a.kind !== 'GOAL')) catalog.set(a.key,meetingFromActivity(a));
  return canonicalMeetingCandidates([...catalog.values()].filter(m => m.kind !== 'GOAL' && inPeriod(m.date,period) && Date.parse(m.date) <= now.getTime())).map(m => {
    const override = period.overrides[m.key];
    const person = override?.profile_id ? config.people.find(p => p.id === override.profile_id) : config.people.find(p => p.user_id === m.user_id);
    const term = person && effective(config.terms.filter(t => t.profile_id === person.id),wibDate(m.date));
    return { ...m, fee_eligible: m.fee_eligible !== false && (term?.contract === 'MITRA' || (term?.contract === 'FULLTIME' && m.kind !== 'TRIAL' && (override?.mode ?? m.mode) === 'MITRA')) };
  });
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
  return { ...config, meetingCandidates: await payrollMeetingCandidates(requestPeriod), admins: await attendanceAdmins(), requests: requests as unknown as ActivityRequest[], periods: periods.map(p => ({ id: p.id, status: p.document.status, version: p.document.version })), selected: selected ?? null, coaches: coaches.data ?? [], classes: classes.data ?? [], audit: selected ? await dao.getPayrollAudit(selected.id) : [] };
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
