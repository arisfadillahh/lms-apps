import { describe, expect, it } from 'vitest';
import { evaluateStudentAttendance, isEnrollmentAtSession } from '@/lib/payroll/studentAttendanceState';
import { buildPayrollActivities, type AttendanceSource, type AssessmentSource, type TrialSource } from '@/lib/payroll/sources';
import { calculatePeriod, createPeriod, DEFAULT_RATES, finalize, type ActivityOverride, type PayrollPerson, type Slip } from '@/lib/payroll/model';
import { payrollActivitySummary, payrollSessionLabel, payrollSlipRows } from '@/lib/payroll/presentation';
import { formatAttendanceRecap } from '@/lib/payroll/attendanceMessage';
import { coachPeriodView } from '@/lib/payroll/coachView';
import { attendancePeriodView } from '@/lib/payroll/attendanceView';
import { meetingMatchesLine, selectedMeetingKeys } from '@/lib/payroll/attendanceDetails';

const cutoff = '2026-11-12T00:00:00+07:00';
const now = new Date('2026-11-26T01:00:00Z');
const person: PayrollPerson = { id: 'p1', user_id: 'u1', kind: 'COACH', name: 'Coach Demo', job_title: 'Coach', active: true, staff_phone: null };
function fixture() {
  return { period: createPeriod(2026, 11), attendanceRequiredFrom: cutoff, now,
    sessions: [{ id: 's1', class_id: 'c1', date_time: '2026-11-12T10:00:00+07:00', status: 'COMPLETED', substitute_coach_id: null as string | null }],
    classes: [{ id: 'c1', name: 'Weekly Robotik', type: 'WEEKLY' as 'WEEKLY' | 'EKSKUL', coach_id: 'u1', delivery_mode: 'ONLINE' as const, payroll_mode: 'MITRA' as 'MITRA' | 'FULLTIME' }],
    enrollments: ['a', 'b', 'c'].map(coder_id => ({ class_id: 'c1', coder_id, enrolled_at: '2026-11-01T00:00:00+07:00', ended_at: null as string | null, status: 'ACTIVE' })),
    leaves: [] as { session_id: string; status: string; substitute_coach_id: string | null }[],
    attendance: [] as AttendanceSource[], trials: [] as TrialSource[], assessments: [] as AssessmentSource[], invoices: [] as { id: string; status: string }[] };
}
function recorded(statuses: string[]): AttendanceSource[] { return statuses.map((status, index) => ({ session_id: 's1', coder_id: ['a', 'b', 'c'][index], status })); }
function calculate(input = fixture(), options: { fulltime?: boolean; override?: ActivityOverride } = {}) {
  if (options.override) input.period.overrides['session:s1'] = options.override;
  const built = buildPayrollActivities(input);
  const p = calculatePeriod({ period: input.period, people: [person, { ...person, id: 'p2', user_id: 'u2' }], terms: ['p1', 'p2'].map(profile_id => ({ profile_id, effective_from: '2020-01-01', contract: options.fulltime ? 'FULLTIME' : 'MITRA', base_salary: options.fulltime ? 4000000 : 0 })), cards: [{ effective_from: '2020-01-01', rates: DEFAULT_RATES }], activities: built.activities, sourceWarnings: built.warnings, now });
  return { p, built, slip: p.slips.find(s => s.profile_id === 'p1')!, line: p.slips.flatMap(s => s.lines).find(l => l.key === 'session:s1')! };
}

describe('shared student attendance state and historical roster', () => {
  it.each([
    [[], { status: 'PENDING', expected: 3, recorded: 0, present: 0 }],
    [['ABSENT'], { status: 'PENDING', expected: 3, recorded: 1, present: 0 }],
    [['PRESENT'], { status: 'PARTIAL', expected: 3, recorded: 1, present: 1 }],
    [['PRESENT', 'LATE', 'EXCUSED'], { status: 'CONFIRMED', expected: 3, recorded: 3, present: 2 }],
    [['ABSENT', 'EXCUSED', 'ABSENT'], { status: 'ALL_ABSENT', expected: 3, recorded: 3, present: 0 }],
  ] as const)('evaluates explicit roster attendance %j', (statuses, expected) => {
    expect(evaluateStudentAttendance(['a', 'b', 'c'], statuses.map((status, index) => ({ coder_id: ['a', 'b', 'c'][index], status })))).toEqual(expected);
  });
  it('deduplicates expected IDs, ignores outsiders/unknown statuses and fails closed for conflicting rows', () => {
    expect(evaluateStudentAttendance(['a', 'a', 'b'], [{ coder_id: 'a', status: 'PRESENT' }, { coder_id: 'a', status: 'PRESENT' }, { coder_id: 'outside', status: 'PRESENT' }, { coder_id: 'b', status: 'INVALID' }])).toEqual({ status: 'PARTIAL', expected: 2, recorded: 1, present: 1 });
    expect(evaluateStudentAttendance(['a'], [{ coder_id: 'a', status: 'PRESENT' }, { coder_id: 'a', status: 'ABSENT' }])).toEqual({ status: 'PENDING', expected: 1, recorded: 0, present: 0 });
    expect(evaluateStudentAttendance([], [{ coder_id: 'outside', status: 'PRESENT' }])).toEqual({ status: 'PENDING', expected: 0, recorded: 0, present: 0 });
  });
  it('uses the enrollment window only for active students and ignores invalid dates', () => {
    const enrollment = { enrolled_at: '2026-11-01T00:00:00+07:00', ended_at: '2026-11-12T10:00:00+07:00', status: 'ACTIVE' };
    expect(isEnrollmentAtSession(enrollment, '2026-11-12T10:00:00+07:00')).toBe(true);
    expect(isEnrollmentAtSession(enrollment, '2026-11-12T10:00:01+07:00')).toBe(false);
    expect(isEnrollmentAtSession({ ...enrollment, status: 'INACTIVE' }, '2026-11-12T09:00:00+07:00')).toBe(false);
    expect(isEnrollmentAtSession({ ...enrollment, enrolled_at: 'invalid' }, '2026-11-12T10:00:00+07:00')).toBe(false);
  });
});

describe('attendance validated coach class fees with explicit cutover', () => {
  it.each(['WEEKLY', 'EKSKUL'] as const)('keeps missing %s student attendance pending at zero fee and blocks finalization', kind => {
    const input = fixture(); input.classes[0].type = kind;
    const { p, line } = calculate(input);
    expect(line).toMatchObject({ quantity: 1, rate: 100000, amount: 0, attendance_status: 'PENDING', attendance_expected: 3, attendance_recorded: 0, fee_eligible: false });
    expect(p.warnings.filter(w => w.startsWith('Absensi siswa'))).toHaveLength(1);
    expect(() => finalize(p, 'admin', now)).toThrow(/peringatan/);
  });
  it('counts at least one present child provisionally at the registered active headcount rate but keeps partial attendance blocking finalization', () => {
    const input = fixture(); input.attendance = recorded(['LATE']);
    const { p, line } = calculate(input);
    expect(line).toMatchObject({ students: 3, rate: 100000, amount: 100000, attendance_status: 'PARTIAL', attendance_recorded: 1, attendance_present: 1, fee_eligible: true });
    expect(p.warnings).toHaveLength(1); expect(() => finalize(p, 'admin', now)).toThrow(/peringatan/);
  });
  it('validates a past scheduled session without a separate coach check-in, using student attendance only', () => {
    const input = fixture(); input.sessions[0].status = 'SCHEDULED'; input.attendance = recorded(['PRESENT', 'ABSENT', 'EXCUSED']);
    const { p, line } = calculate(input);
    expect(line.amount).toBe(100000); expect(line.attendance_status).toBe('CONFIRMED'); expect(p.warnings).toEqual([]); expect(finalize(p, 'admin', now).status).toBe('FINAL');
  });
  it('records an all-absent completed session as non-teaching and zero fee with no pending warning', () => {
    const input = fixture(); input.attendance = recorded(['ABSENT', 'EXCUSED', 'ABSENT']);
    const { p, line, slip } = calculate(input);
    expect(line).toMatchObject({ quantity: 1, amount: 0, attendance_status: 'ALL_ABSENT', fee_eligible: false }); expect(p.warnings).toEqual([]);
    expect(payrollActivitySummary(slip)).toBe('Belum ada aktivitas'); expect(formatAttendanceRecap(p, slip)).toContain('Total: 0 aktivitas.'); expect(formatAttendanceRecap(p, slip)).toContain('tidak ada siswa hadir');
  });
  it('uses only the active session roster and ignores another session or unenrolled student attendance', () => {
    const input = fixture(); input.enrollments[1].ended_at = '2026-11-11T23:59:59+07:00'; input.enrollments[2].enrolled_at = '2026-11-13T00:00:00+07:00'; input.attendance = [{ session_id: 's1', coder_id: 'outside', status: 'PRESENT' }, { session_id: 'other', coder_id: 'a', status: 'PRESENT' }];
    expect(calculate(input).line).toMatchObject({ students: 1, amount: 0, attendance_status: 'PENDING' });
    input.attendance.push({ session_id: 's1', coder_id: 'a', status: 'PRESENT' }); expect(calculate(input).line).toMatchObject({ students: 1, amount: 70000, attendance_status: 'CONFIRMED' });
  });
  it('applies student validation to the assigned substitute without duplicating the original coach', () => {
    const input = fixture(); input.leaves.push({ session_id: 's1', status: 'APPROVED', substitute_coach_id: 'u2' }); input.attendance = recorded(['PRESENT', 'ABSENT', 'ABSENT']);
    const { p } = calculate(input);
    expect(p.slips.find(s => s.profile_id === 'p1')!.lines).toHaveLength(0);
    expect(p.slips.find(s => s.profile_id === 'p2')!.lines[0]).toMatchObject({ amount: 100000, attendance_status: 'CONFIRMED' });
  });
  it.each(['cancelled', 'leave-without-substitute'])('preserves %s precedence over student presence or teaching confirmation', reason => {
    const input = fixture(); if (reason === 'cancelled') input.sessions[0].status = 'CANCELLED'; else input.leaves.push({ session_id: 's1', status: 'APPROVED', substitute_coach_id: null });
    input.attendance = recorded(['PRESENT', 'PRESENT', 'PRESENT']);
    const { p, line } = calculate(input, { override: { teaching_confirmed: true, reason: 'Keputusan operasional oleh PIC' } });
    expect(line.amount).toBe(0); expect(line.details).toContain('dibatalkan'); expect(p.warnings).toEqual([]);
  });
  it('never retroactively gates old sessions when a cutoff is omitted or their date precedes the cutover', () => {
    const input = fixture(); input.sessions[0].date_time = '2026-11-11T23:59:59+07:00';
    expect(calculate(input).line).toMatchObject({ amount: 100000 }); expect(calculate(input).line.attendance_status).toBeUndefined();
    const { attendanceRequiredFrom: _cutoff, ...oldInput } = fixture();
    expect(_cutoff).toBe(cutoff);
    expect(buildPayrollActivities(oldInput).activities[0].attendance_status).toBeUndefined();
    input.sessions[0].date_time = cutoff; expect(calculate(input).line).toMatchObject({ amount: 0, attendance_status: 'PENDING' });
  });
  it('fails closed when required attendance was not fetched and rejects invalid cutover dates', () => {
    const { attendance: _attendance, ...input } = fixture(); expect(_attendance).toBeDefined(); expect(buildPayrollActivities(input).activities[0]).toMatchObject({ attendance_status: 'PENDING', fee_eligible: false });
    expect(() => buildPayrollActivities({ ...fixture(), attendanceRequiredFrom: 'bad-date' })).toThrow(/Tanggal mulai/);
  });
  it('prevents native meetings after cutover from being reused as evidence for frozen class summaries', () => {
    const { slip } = calculate(fixture()); const native = slip.attendance_details![0];
    const line = { kind: 'CLASS_SUMMARY', label: 'Kelas online · 3+ anak', summary_before: cutoff };
    expect(meetingMatchesLine({ ...native, fee_eligible: true }, line)).toBe(false);
    expect(meetingMatchesLine({ ...native, date: '2026-11-11T23:59:59+07:00', fee_eligible: true }, line)).toBe(true);
    expect(selectedMeetingKeys({ meeting_keys: [], selection_cutoff: '2026-11-01T00:00:00+07:00' }, [{ ...native, origin: 'SOURCE', fee_eligible: true }], line, 'u1')).toEqual([]);
  });
  it('leaves fulltime base salary unchanged even when a class is pending or all absent', () => {
    const input = fixture(); input.classes[0].payroll_mode = 'FULLTIME';
    const pending = calculate(input, { fulltime: true }); expect(pending.slip.total).toBe(4000000); expect(pending.line.amount).toBe(0); expect(pending.p.warnings).toHaveLength(1);
    input.attendance = recorded(['ABSENT', 'ABSENT', 'ABSENT']); const absent = calculate(input, { fulltime: true }); expect(absent.slip.total).toBe(4000000); expect(absent.p.warnings).toEqual([]);
  });
  it('keeps trial validation tied to the assigned coach assessment instead of regular student attendance', () => {
    const input = fixture(); input.sessions = []; input.trials = [{ id: 'trial1', student_name: 'Trial Student', phone: '081234567890', trial_mode: 'ONLINE', status: 'SCHEDULED', coach_id: 'u1', scheduled_at: '2026-11-12T10:00:00+07:00', duration_minutes: 60 }];
    expect(calculate(input).built.activities).toHaveLength(0);
    input.assessments = [{ id: 'assessment1', trial_id: 'trial1', coach_id: 'u1', status: 'PENDING_ADMIN_REVIEW', submitted_at: '2026-11-12T11:00:00+07:00', invoice_id: null, payment_confirmed_at: null, coder_id: null }];
    const { p, built } = calculate(input); expect(built.activities).toHaveLength(1); expect(built.activities[0].attendance_status).toBeUndefined();
    expect(p.slips.find(s => s.profile_id === 'p1')!.lines[0]).toMatchObject({ kind: 'TRIAL', amount: 25000 }); expect(p.warnings).toEqual([]);
  });
});

describe('reasoned attendance exceptions and money-free projections', () => {
  it.each(['PENDING', 'ALL_ABSENT'] as const)('supports explicit operational force-confirmation from %s at the normal automatic rate', status => {
    const input = fixture(); if (status === 'ALL_ABSENT') input.attendance = recorded(['ABSENT', 'EXCUSED', 'ABSENT']);
    const { p, line, slip } = calculate(input, { override: { teaching_confirmed: true, reason: 'Coach tetap mengajar sesuai pemeriksaan PIC' } });
    expect(line).toMatchObject({ amount: 100000, attendance_status: 'CONFIRMED', teaching_confirmed: true, fee_eligible: true }); expect(p.warnings).toEqual([]);
    expect(slip.attendance_details![0]).toMatchObject({ attendance_status: 'CONFIRMED', teaching_confirmed: true, fee_eligible: true });
    expect(formatAttendanceRecap(p, slip)).toContain('mengajar dikonfirmasi admin');
  });
  it('supports force non-teaching, documented exclusion, and existing financial compensation without recurring salary changes', () => {
    const input = fixture(); input.attendance = recorded(['PRESENT']);
    const denied = calculate(input, { override: { teaching_confirmed: false, reason: 'Kelas tidak berjalan setelah diperiksa' } }); expect(denied.line).toMatchObject({ amount: 0, teaching_confirmed: false, fee_eligible: false }); expect(denied.p.warnings).toEqual([]);
    const excluded = calculate(fixture(), { override: { excluded: true, reason: 'Pengecualian sesuai keputusan PIC' } }); expect(excluded.line.amount).toBe(0); expect(excluded.p.warnings).toEqual([]);
    const compensated = calculate(fixture(), { override: { amount: 50000, reason: 'Kompensasi khusus setelah pemeriksaan finance' } }); expect(compensated.line.amount).toBe(50000); expect(compensated.p.warnings).toEqual([]);
    const noRoster = fixture(); noRoster.enrollments = []; const notTaught = calculate(noRoster, { override: { teaching_confirmed: false, reason: 'Tidak ada siswa terdaftar dan kelas tidak berjalan' } }); expect(notTaught.line.amount).toBe(0); expect(notTaught.p.warnings).toEqual([]);
  });
  it('does not let mode/recipient changes, bare reasons or unreasoned force fields bypass student validation', () => {
    for (const override of [{ mode: 'MITRA' as const, reason: 'Mode dikoreksi admin' }, { reason: 'Sudah dicek admin' }, { teaching_confirmed: true, reason: 'x' }, { amount: 50000, reason: '' }]) {
      const { p, line } = calculate(fixture(), { override }); expect(line.amount).toBe(0); expect(p.warnings.some(w => w.startsWith('Absensi siswa'))).toBe(true);
    }
  });
  it('shows operational counts and resolution to admin/lead/coach without exposing fee values or exception notes', () => {
    const { p } = calculate(fixture(), { override: { amount: 50000, reason: 'Nominal internal finance 50000' } });
    const lead = attendancePeriodView({ id: p.id, revision: 1, document: p });
    expect(lead.activities[0]).toMatchObject({ attendance_status: 'PENDING', attendance_expected: 3, attendance_recorded: 0, attendance_override: true });
    expect(lead.overrides['session:s1'].reason).toBe('');
    const coach = coachPeriodView(p, 'u1'); expect(coach!.activities[0].status).toBe('Menunggu absensi siswa');
    expect(JSON.stringify({ lead, coach })).not.toMatch(/50000|rate|amount|total|Nominal internal/);
  });
  it('excludes pending/non-teaching counts from summaries while preserving exact compensation sums and fulltime zero-fee teaching attendance', () => {
    const { slip } = calculate(fixture());
    const base = slip.lines[0];
    const mixed: Slip = { ...slip, lines: [base, { ...base, key: 'absent', attendance_status: 'ALL_ABSENT', amount: 20000, fee_eligible: false }, { ...base, key: 'present', attendance_status: 'CONFIRMED', amount: 100000, fee_eligible: true }, { ...base, key: 'salary-covered', attendance_status: 'CONFIRMED', amount: 0, mode: 'FULLTIME', fee_eligible: true }] };
    expect(payrollActivitySummary(mixed)).toBe('2 kelas online');
    expect(payrollSlipRows(mixed)).toEqual([{ label: 'Fee mengajar kelas', quantity: '1 sesi', amount: 120000 }]);
    const offline = { ...base, key: 'offline', kind: 'EKSKUL', students: 2, details: 'EKSKUL · OFFLINE · 2 anak aktif', fee_eligible: true };
    expect(payrollSessionLabel(mixed, offline)).toBe('Ekskul offline · 2 anak');
    expect(payrollActivitySummary({ ...mixed, lines: [...mixed.lines, offline] })).toBe('1 ekskul offline · 2 kelas online');
  });
});
