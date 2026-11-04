import { createHash } from 'node:crypto';
import { inPeriod, type Activity, type PeriodDocument, type PayrollPerson } from './model';

export interface ClassSource { id: string; name: string; type: 'WEEKLY' | 'EKSKUL'; coach_id: string; delivery_mode: 'ONLINE' | 'OFFLINE'; payroll_mode?: 'FULLTIME' | 'MITRA' | null }
export interface SessionSource { id: string; class_id: string; date_time: string; status: string; substitute_coach_id: string | null; payroll_mode?: 'FULLTIME' | 'MITRA' | null }
export interface EnrollmentSource { class_id: string; coder_id: string; enrolled_at: string; ended_at: string | null; status: string }
export interface LeaveSource { session_id: string; status: string; substitute_coach_id: string | null }
export interface TrialSource { id: string; student_name: string; phone: string; trial_mode: 'ONLINE' | 'OFFLINE'; status: string; coach_id: string | null; scheduled_at: string | null; duration_minutes: number }
export interface AssessmentSource { id: string; trial_id: string; coach_id: string; status: string; submitted_at: string | null; invoice_id: string | null; payment_confirmed_at: string | null; coder_id: string | null }

export function buildPayrollActivities(input: {
  period: PeriodDocument; sessions: SessionSource[]; classes: ClassSource[]; enrollments: EnrollmentSource[];
  leaves: LeaveSource[]; trials: TrialSource[]; assessments: AssessmentSource[];
  invoices: { id: string; status: string }[]; now?: Date;
}) {
  const { period, sessions, classes, enrollments, leaves, trials, assessments, invoices } = input;
  const now = input.now ?? new Date();
  const activities: Activity[] = [];
  const warnings: string[] = [];
  for (const s of sessions) {
    if (!inPeriod(s.date_time, period) || Date.parse(s.date_time) > now.getTime()) continue;
    const klass = classes.find(c => c.id === s.class_id);
    if (!klass) { warnings.push(`Sumber kelas tidak ditemukan untuk sesi ${s.id}`); continue; }
    const approved = leaves.find(l => l.session_id === s.id && l.status === 'APPROVED');
    const payee = s.substitute_coach_id || approved?.substitute_coach_id || klass.coach_id;
    const cancelled = s.status === 'CANCELLED' || Boolean(approved && !approved.substitute_coach_id && !s.substitute_coach_id);
    const students = new Set(enrollments.filter(e => e.class_id === klass.id && Date.parse(e.enrolled_at) <= Date.parse(s.date_time) &&
      (e.ended_at ? Date.parse(s.date_time) <= Date.parse(e.ended_at) : e.status === 'ACTIVE')).map(e => e.coder_id)).size;
    activities.push({ key: `session:${s.id}`, user_id: payee, date: s.date_time, label: klass.name,
      kind: klass.type, delivery: klass.delivery_mode, mode: s.payroll_mode ?? klass.payroll_mode ?? 'FULLTIME', students, cancelled,
      details: [klass.type, klass.delivery_mode, `${students} anak aktif`, payee !== klass.coach_id ? 'Coach pengganti' : 'Coach utama',
        !s.payroll_mode && !klass.payroll_mode ? 'Mode belum ditetapkan admin' : ''].filter(Boolean).join(' · ') });
  }
  // One teacher at the same instant/mode is one trial session, even if several
  // separate child registrations share it. Bonus conversion remains per child.
  const groups = new Map<string, TrialSource[]>();
  for (const t of trials) {
    if (!t.coach_id || !t.scheduled_at || !inPeriod(t.scheduled_at, period)) continue;
    if (Date.parse(t.scheduled_at) > now.getTime()) continue;
    const key = `trial:${t.coach_id}:${new Date(t.scheduled_at).toISOString()}:${t.trial_mode}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  for (const [key, group] of groups) {
    const valid = group.filter(t => !['CANCELLED', 'FAILED'].includes(t.status));
    const submitted = valid.filter(t => assessments.some(a => a.trial_id === t.id && a.coach_id === t.coach_id && a.status !== 'DRAFT' && a.submitted_at && Date.parse(a.submitted_at) <= now.getTime()));
    if (!submitted.length) continue;
    const first = group[0];
    activities.push({ key, user_id: first.coach_id!, date: first.scheduled_at!, label: `Trial (${valid.length} anak)`,
      kind: 'TRIAL', mode: 'MITRA', delivery: first.trial_mode, students: valid.length, cancelled: valid.length === 0,
      details: `Satu sesi trial, ${valid.length} peserta: ${valid.map(t => t.student_name).join(', ')} · ${submitted.length} penilaian terkirim oleh coach yang ditugaskan` });
  }
  const paid = assessments.filter(a => a.invoice_id && invoices.some(i => i.id === a.invoice_id && i.status === 'PAID') && a.payment_confirmed_at)
    .sort((a, b) => a.payment_confirmed_at!.localeCompare(b.payment_confirmed_at!) || a.id.localeCompare(b.id));
  const children = new Set<string>();
  for (const a of paid) {
    const t = trials.find(t => t.id === a.trial_id);
    if (!t || ['CANCELLED', 'FAILED'].includes(t.status)) continue;
    // The parent/child registration identity also covers historical paid trials
    // before Admin creates the LMS coder account. Hash prevents phone in IDs/PDF.
    const identity = `${t.phone.replace(/\D/g, '').replace(/^0/, '62')}|${t.student_name.trim().toLocaleLowerCase('id-ID').replace(/\s+/g, ' ')}`;
    const key = createHash('sha256').update(identity).digest('hex').slice(0, 32);
    if (children.has(key)) continue;
    children.add(key);
    if (!inPeriod(a.payment_confirmed_at!, period) || Date.parse(a.payment_confirmed_at!) > now.getTime()) continue;
    activities.push({ key: `goal:${key}`, user_id: a.coach_id, date: a.payment_confirmed_at!, label: `Bonus goal: ${t.student_name}`,
      kind: 'GOAL', mode: 'MITRA', delivery: t.trial_mode, students: 1, cancelled: false,
      details: 'Invoice lunas; bonus konversi pertama untuk anak ini.' });
  }
  for (const a of assessments) if (a.invoice_id && invoices.some(i => i.id === a.invoice_id && i.status === 'PAID') && !a.payment_confirmed_at) {
    const t = trials.find(t => t.id === a.trial_id);
    if (t?.scheduled_at && inPeriod(t.scheduled_at, period)) warnings.push(`Tanggal konfirmasi lunas trial ${t.student_name} belum tersedia; periksa sebelum memberi bonus manual.`);
  }
  return { activities, warnings };
}

export function profilePhone(person: PayrollPerson, coach?: { parent_contact_phone: string | null } | null): string | null {
  // Coach contact MUST come from the live LMS profile, never an archived salary
  // document, staff override, Telegram identifier or a parent's student record.
  return person.kind === 'COACH' ? coach?.parent_contact_phone?.trim() || null : person.staff_phone?.trim() || null;
}
