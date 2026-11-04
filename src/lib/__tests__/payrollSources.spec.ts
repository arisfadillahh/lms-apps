import { describe, expect, it } from 'vitest';
import { buildPayrollActivities, profilePhone, type TrialSource, type AssessmentSource } from '@/lib/payroll/sources';
import { createPeriod, type PayrollPerson } from '@/lib/payroll/model';

const period = createPeriod(2026, 11);
const now = new Date('2026-11-26T01:00:00Z');
const base = () => ({ period, now, sessions: [{ id: 's', class_id: 'c', date_time: '2026-11-25T20:00:00+07:00', status: 'COMPLETED', substitute_coach_id: null as string | null }],
  classes: [{ id: 'c', name: 'Kelas nyata', type: 'WEEKLY' as const, coach_id: 'u1', delivery_mode: 'ONLINE' as const, payroll_mode: 'MITRA' as const }],
  enrollments: [{ class_id: 'c', coder_id: 'a', enrolled_at: '2026-10-01T00:00:00Z', ended_at: null as string | null, status: 'ACTIVE' }],
  leaves: [] as { session_id: string; status: string; substitute_coach_id: string | null }[], trials: [] as TrialSource[],
  assessments: [] as AssessmentSource[], invoices: [] as { id: string; status: string }[] });
const trial = (id = 't1', patch: Partial<TrialSource> = {}): TrialSource => ({ id, student_name: 'Anak contoh', phone: '081234567890', trial_mode: 'ONLINE', status: 'SCHEDULED', coach_id: 'u1', scheduled_at: '2026-11-20T10:00:00+07:00', duration_minutes: 60, ...patch });
const submitted = (trialId = 't1', patch: Partial<AssessmentSource> = {}): AssessmentSource => ({ id: `assessment:${trialId}`, trial_id: trialId, coach_id: 'u1', status: 'PENDING_ADMIN_REVIEW', submitted_at: '2026-11-20T11:00:00+07:00', invoice_id: null, payment_confirmed_at: null, coder_id: null, ...patch });
describe('LMS operational sources feed payroll without coach check-in', () => {
  it('counts a scheduled session automatically after its scheduled time, including the evening of the 25th', () => { const b = base(); b.sessions[0].status = 'SCHEDULED'; expect(buildPayrollActivities(b).activities[0].user_id).toBe('u1'); });
  it('uses enrollment history on session date rather than current class totals or pupil attendance', () => {
    const b = base(); b.enrollments.push({ ...b.enrollments[0], coder_id: 'future', enrolled_at: '2026-11-26T00:00:00+07:00' }, { ...b.enrollments[0], coder_id: 'ended', ended_at: '2026-11-24T00:00:00+07:00', status: 'INACTIVE' });
    expect(buildPayrollActivities(b).activities[0].students).toBe(1);
  });
  it('transfers attendance to the assigned substitute without duplicating the original', () => { const b = base(); b.sessions[0].substitute_coach_id = 'u2'; const a = buildPayrollActivities(b).activities; expect(a).toHaveLength(1); expect(a[0].user_id).toBe('u2'); });
  it('uses approved leave replacement and does not redirect pending leave', () => {
    const b = base(); b.leaves.push({ session_id: 's', status: 'PENDING', substitute_coach_id: 'u2' }); expect(buildPayrollActivities(b).activities[0].user_id).toBe('u1');
    b.leaves[0].status = 'APPROVED'; expect(buildPayrollActivities(b).activities[0].user_id).toBe('u2');
  });
  it('retains a cancelled source with zero-pay classification for possible documented admin compensation', () => { const b = base(); b.sessions[0].status = 'CANCELLED'; expect(buildPayrollActivities(b).activities[0].cancelled).toBe(true); });
  it('does not accrue future sessions', () => { const b = base(); b.sessions[0].date_time = '2026-11-27T01:00:00Z'; expect(buildPayrollActivities(b).activities).toHaveLength(0); });
  it('groups several assessed children sharing one coach/time into one trial session fee', () => { const b = base(); b.trials = [trial(), trial('t2', { student_name: 'Anak kedua' })]; b.assessments = [submitted(), submitted('t2')]; const a = buildPayrollActivities(b).activities.filter(a => a.kind === 'TRIAL'); expect(a).toHaveLength(1); expect(a[0].students).toBe(2); });
  it('excludes cancelled trials even if an assessment was submitted', () => { const b = base(); b.trials = [trial('t1', { status: 'CANCELLED' }), trial('t2')]; b.assessments = [submitted(), submitted('t2')]; expect(buildPayrollActivities(b).activities.find(a => a.kind === 'TRIAL')?.students).toBe(1); });
  it('does not count trial attendance only because its scheduled time and duration have elapsed', () => { const b = base(); b.trials = [trial()]; expect(buildPayrollActivities(b).activities.filter(a => a.kind === 'TRIAL')).toHaveLength(0); });
  it('requires submitted assessment by the assigned coach, excluding drafts and another coach', () => {
    const b = base(); b.trials = [trial()];
    for (const a of [submitted('t1', { status: 'DRAFT' }), submitted('t1', { submitted_at: null }), submitted('t1', { coach_id: 'u2' })]) { b.assessments = [a]; expect(buildPayrollActivities(b).activities.filter(a => a.kind === 'TRIAL')).toHaveLength(0); }
    b.assessments = [submitted()]; expect(buildPayrollActivities(b).activities.find(a => a.kind === 'TRIAL')?.user_id).toBe('u1');
  });
  it('keeps the session date period when an assessment is submitted after cutoff', () => {
    const b = base(); b.trials = [trial('t1', { scheduled_at: '2026-11-25T20:00:00+07:00' })]; b.assessments = [submitted('t1', { submitted_at: '2026-11-26T07:00:00+07:00' })];
    expect(buildPayrollActivities(b).activities.find(a => a.kind === 'TRIAL')?.date).toBe(b.trials[0].scheduled_at);
  });
  it('bonus requires a paid invoice, uses its confirmation date, and stays with the trial coach', () => {
    const b = base(); b.trials = [trial()]; b.assessments = [submitted('t1', { id: 'a', coach_id: 'u2', status: 'PUBLISHED', invoice_id: 'i', payment_confirmed_at: '2026-11-25T22:00:00+07:00' })]; b.invoices = [{ id: 'i', status: 'PENDING' }];
    expect(buildPayrollActivities(b).activities.some(a => a.kind === 'GOAL')).toBe(false);
    b.invoices[0].status = 'PAID'; const a = buildPayrollActivities(b).activities.find(a => a.kind === 'GOAL'); expect(a?.user_id).toBe('u2'); expect(a?.date).toBe(b.assessments[0].payment_confirmed_at);
  });
  it('a repeated trial for the same child cannot produce a second conversion bonus', () => {
    const b = base(); b.trials = [trial(), trial('t2')]; b.invoices = [{ id: 'i1', status: 'PAID' }, { id: 'i2', status: 'PAID' }];
    b.assessments = b.trials.map((t, i) => submitted(t.id, { id: 'a' + i, status: 'PAID', invoice_id: 'i' + (i + 1), payment_confirmed_at: `2026-11-${20 + i}T00:00:00Z` }));
    expect(buildPayrollActivities(b).activities.filter(a => a.kind === 'GOAL')).toHaveLength(1);
    b.assessments[0].payment_confirmed_at = '2026-10-01T00:00:00Z'; expect(buildPayrollActivities(b).activities.filter(a => a.kind === 'GOAL')).toHaveLength(0);
  });
  it('never borrows a phone override for a coach: empty LMS profile means no WhatsApp', () => {
    const p: PayrollPerson = { id: 'p', user_id: 'u', kind: 'COACH', name: 'Coach', job_title: '', active: true, staff_phone: '081111111111' };
    expect(profilePhone(p, { parent_contact_phone: null })).toBeNull();
    expect(profilePhone(p, { parent_contact_phone: '082222222222' })).toBe('082222222222');
    expect(profilePhone({ ...p, kind: 'STAFF' })).toBe('081111111111');
  });
});
