import { describe, expect, it } from 'vitest';
import { applyAttendancePolicy, STUDENT_ATTENDANCE_FROM } from '@/lib/payroll/attendancePolicy';
import { calculateSynchronizedPeriod } from '@/lib/payroll/synchronizedPeriod';
import { createPeriod, DEFAULT_RATES, type Activity, type PeriodDocument, type PayrollPerson, type PayrollTerm } from '@/lib/payroll/model';
import type { LegacyPayrollSnapshot } from '@/lib/payroll/legacyImport';

const beforeCutover = new Date('2026-11-11T16:59:59.999Z');
const afterCutover = new Date('2026-11-13T08:00:00.000Z');
const person: PayrollPerson = { id: 'profile', user_id: 'coach', kind: 'COACH', name: 'Coach fixture', job_title: 'Coach', staff_phone: null, active: true };
const term: PayrollTerm = { profile_id: person.id, contract: 'MITRA', base_salary: 0, effective_from: '2026-10-26' };

function snapshot(): LegacyPayrollSnapshot {
  return {
    schema: 1, sourceId: 'sheet-current', sourceName: 'Synthetic test source', url: 'https://example.invalid/synthetic', period: '2026-11',
    sourceCreatedAt: '2026-11-01T00:00:00Z', sourceModifiedAt: '2026-11-11T08:00:00Z', capturedAt: '2026-11-11T08:01:00Z', checksum: 'a'.repeat(64),
    rows: [{
      sourceId: 'source-coach', name: 'Synthetic source name', username: '',
      counters: [{ label: 'Absen Online', value: 2 }, { label: 'Absen Trial', value: 1 }, { label: 'Absen Event', value: 1 }],
      fees: [{ label: 'Fee Online', value: 200000 }, { label: 'Fee Trial', value: 25000 }, { label: 'Fee Event', value: 180000 }],
      total: 405000, sourceTotal: 405000, extras: [],
    }], total: 405000, totalBasis: 'SOURCE_TOTAL',
  };
}

function importedPeriod(): PeriodDocument {
  return {
    ...createPeriod(2026, 11), legacy_imports: [snapshot()],
    legacy_links: { 'source-coach': { status: 'LINKED', profile_id: person.id, user_id: person.user_id!, kind: person.kind, name: person.name, confirmed_at: '2026-11-05T00:00:00Z', reason: 'Confirmed fixture mapping' } },
  };
}

function meeting(extra: Partial<Activity> = {}): Activity {
  return {
    key: 'session:native', user_id: person.user_id!, date: '2026-11-12T08:00:00Z', label: 'Native robotics class',
    kind: 'WEEKLY', mode: 'MITRA', delivery: 'ONLINE', students: 3, cancelled: false,
    attendance_status: 'CONFIRMED', attendance_expected: 3, attendance_recorded: 3, attendance_present: 1, fee_eligible: true,
    ...extra,
  };
}

function calculate(period: PeriodDocument, activities?: Activity[], terms: PayrollTerm[] = [term], includeRecurring = true) {
  return calculateSynchronizedPeriod({ period, people: [person], terms, cards: [{ effective_from: '2026-10-26', rates: DEFAULT_RATES }], now: afterCutover, includeRecurring, ...(activities === undefined ? {} : { activities }) });
}

function refreshCounters(period: PeriodDocument): PeriodDocument {
  const next = structuredClone(period), source = next.legacy_imports![0], row = source.rows[0];
  source.capturedAt = '2026-11-13T07:00:00Z'; source.sourceModifiedAt = source.capturedAt; source.checksum = 'b'.repeat(64);
  row.counters = [{ label: 'Absen Online', value: 9 }, { label: 'Absen Trial', value: 2 }, { label: 'Absen Event', value: 2 }];
  row.fees = [{ label: 'Fee Online', value: 900000 }, { label: 'Fee Trial', value: 50000 }, { label: 'Fee Event', value: 360000 }];
  row.total = 1310000; row.sourceTotal = row.total; source.total = row.total;
  return next;
}

describe('prospective student attendance cutover policy', () => {
  it('defines the cutover at midnight WIB, not midnight UTC', () => {
    expect(new Date(STUDENT_ATTENDANCE_FROM).toISOString()).toBe('2026-11-11T17:00:00.000Z');
  });

  it('captures the latest verified pre-cutover snapshot without mutating the input', () => {
    const period = importedPeriod(), original = structuredClone(period);
    const older = { ...snapshot(), sourceId: 'older-sheet', sourceCreatedAt: '2026-10-01T00:00:00Z', checksum: 'c'.repeat(64) };
    period.legacy_imports!.unshift(older);
    const expected = structuredClone(period);
    const result = applyAttendancePolicy(period, beforeCutover);
    expect(result.class_attendance_from).toBe(STUDENT_ATTENDANCE_FROM);
    expect(result.legacy_class_baseline).toEqual(snapshot());
    expect(result.legacy_class_baseline).not.toBe(period.legacy_imports![1]);
    expect(period).toEqual(expected);
    expect(original.legacy_class_baseline).toBeUndefined();
  });

  it('advances the baseline while source snapshots are still pre-cutover', () => {
    const first = applyAttendancePolicy(importedPeriod(), beforeCutover);
    const refreshed = refreshCounters(first);
    refreshed.legacy_imports![0].capturedAt = '2026-11-11T16:59:00Z';
    const latest = applyAttendancePolicy(refreshed, new Date('2026-11-11T16:59:30Z'));
    expect(latest.legacy_class_baseline).toEqual(refreshed.legacy_imports![0]);
    expect(applyAttendancePolicy(latest, afterCutover).legacy_class_baseline).toEqual(latest.legacy_class_baseline);
  });

  it('preserves the frozen baseline on repeated calculations and later source refreshes', () => {
    const first = applyAttendancePolicy(importedPeriod(), beforeCutover);
    const refreshed = refreshCounters(first);
    const repeated = applyAttendancePolicy(refreshed, afterCutover);
    expect(repeated.legacy_class_baseline).toEqual(first.legacy_class_baseline);
    expect(repeated.legacy_imports![0].checksum).toBe('b'.repeat(64));
    expect(applyAttendancePolicy(repeated, afterCutover)).toEqual(repeated);
  });

  it('rejects a first capture at or after the cutover even if the retained source was captured earlier', () => {
    for (const now of [new Date(STUDENT_ATTENDANCE_FROM), afterCutover]) {
      expect(() => applyAttendancePolicy(importedPeriod(), now)).toThrow(/Baseline.*belum tersimpan/);
    }
  });

  it('rejects a source captured at or after cutover even while the server clock is earlier', () => {
    for (const capturedAt of [STUDENT_ATTENDANCE_FROM, afterCutover.toISOString()]) {
      const period = importedPeriod(); period.legacy_imports![0].capturedAt = capturedAt;
      expect(() => applyAttendancePolicy(period, beforeCutover)).toThrow(/Baseline.*belum tersimpan/);
    }
  });

  it('preserves FINAL versions and historical imported archives that are still DRAFT', () => {
    const final = { ...importedPeriod(), status: 'FINAL' as const };
    const archive = { ...importedPeriod(), ...createPeriod(2026, 10) };
    for (const period of [final, archive]) {
      const before = structuredClone(period);
      expect(applyAttendancePolicy(period, afterCutover)).toEqual(before);
      expect(period).toEqual(before);
      expect(applyAttendancePolicy(period, afterCutover).class_attendance_from).toBeUndefined();
    }
  });

  it('enables native future periods without requiring an imported financial baseline', () => {
    const result = applyAttendancePolicy(createPeriod(2026, 12), new Date('2026-12-01T00:00:00Z'));
    expect(result.class_attendance_from).toBe(STUDENT_ATTENDANCE_FROM);
    expect(result.legacy_class_baseline).toBeUndefined();
  });
});

describe('frozen imported class baseline with prospective native attendance', () => {
  it('replaces imported classes and trials for an entire period while retaining event amounts', () => {
    const imported = importedPeriod();
    const period = applyAttendancePolicy({ ...imported, class_attendance_from: imported.starts_at }, afterCutover);
    const lesson = meeting({ date: '2026-11-01T08:00:00Z' });
    const trial = meeting({ key: 'trial:form', date: lesson.date, kind: 'TRIAL' });
    const result = calculate(period, [lesson, trial]);
    const lines = result.slips[0].lines;
    expect(lines.some(line => line.kind === 'CLASS_SUMMARY')).toBe(false);
    expect(lines.filter(line => line.kind === 'TRIAL')).toMatchObject([{ key: trial.key, amount: 25000 }]);
    expect(lines.find(line => line.key === lesson.key)?.amount).toBe(100000);
    expect(lines.find(line => line.kind === 'EVENT')?.amount).toBe(180000);
    expect(calculateSynchronizedPeriod({ period: result, people: [person], terms: [term], cards: [{ effective_from: '2026-10-26', rates: DEFAULT_RATES }], now: afterCutover, includeRecurring: true }).slips[0].lines)
      .toEqual(lines);
  });

  it('freezes class quantity/amount while trial and event counters continue to refresh', () => {
    const result = calculate(refreshCounters(applyAttendancePolicy(importedPeriod(), beforeCutover)), []);
    const lines = result.slips[0].lines;
    expect(lines.find(line => line.kind === 'CLASS_SUMMARY')).toMatchObject({ quantity: 2, amount: 200000 });
    expect(lines.find(line => line.kind === 'TRIAL')).toMatchObject({ quantity: 2, amount: 50000 });
    expect(lines.find(line => line.kind === 'EVENT')).toMatchObject({ quantity: 2, amount: 360000 });
    expect(result.slips[0].total).toBe(610000);
  });

  it('counts native classes only from the exact cutoff, once, using total enrolled headcount', () => {
    const period = applyAttendancePolicy(importedPeriod(), beforeCutover);
    const before = meeting({ key: 'session:before', date: beforeCutover.toISOString() });
    const at = meeting({ key: 'session:at', date: new Date(STUDENT_ATTENDANCE_FROM).toISOString(), kind: 'EKSKUL', delivery: 'OFFLINE' });
    const after = meeting();
    const first = calculate(period, [before, at, after, after]);
    expect(first.slips[0].lines.filter(line => ['WEEKLY', 'EKSKUL'].includes(line.kind))).toHaveLength(2);
    expect(first.slips[0].lines.find(line => line.key === at.key)).toMatchObject({ amount: 125000, students: 3 });
    expect(first.slips[0].lines.find(line => line.key === after.key)).toMatchObject({ amount: 100000, students: 3, attendance_present: 1 });
    expect(first.slips[0].total).toBe(630000);
    expect(calculate(first, [before, at, after, after]).slips).toEqual(first.slips);
  });

  it('makes a later all-absent correction zero only the native meeting, leaving the frozen baseline intact', () => {
    const period = applyAttendancePolicy(importedPeriod(), beforeCutover);
    const present = calculate(period, [meeting()]);
    const absent = meeting({ attendance_status: 'ALL_ABSENT', attendance_present: 0, fee_eligible: false });
    const corrected = calculate(present, [absent]);
    expect(corrected.slips[0].lines.find(line => line.key === absent.key)?.amount).toBe(0);
    expect(corrected.slips[0].lines.find(line => line.kind === 'CLASS_SUMMARY')).toMatchObject({ quantity: 2, amount: 200000 });
    expect(corrected.slips[0].total).toBe(405000);
    expect(calculate(corrected, [absent]).slips).toEqual(corrected.slips);
  });

  it('preserves verified native meeting lines during a source-only refresh and replaces them on explicit native re-read', () => {
    const first = calculate(applyAttendancePolicy(importedPeriod(), beforeCutover), [meeting()]);
    const refreshed = refreshCounters(first);
    const sourceOnly = calculate(refreshed);
    expect(sourceOnly.slips[0].lines.find(line => line.key === 'session:native')).toEqual(first.slips[0].lines.find(line => line.key === 'session:native'));
    expect(sourceOnly.slips[0].total).toBe(710000);
    expect(calculate(sourceOnly).slips).toEqual(sourceOnly.slips);
    expect(calculate(sourceOnly, []).slips[0].total).toBe(610000);
  });

  it('preserves reasoned native and imported financial exceptions plus monthly components on refresh', () => {
    const period = applyAttendancePolicy(importedPeriod(), beforeCutover);
    period.overrides['summary:source-coach:Fee Online'] = { amount: 230000, reason: 'Approved source adjustment' };
    period.overrides['session:native'] = { amount: 88000, reason: 'Finance approved exception' };
    period.manual.push({ id: 'monthly', profile_id: person.id, date: '2026-11-12T08:00:00Z', label: 'Transport', amount: 22000, reason: 'Monthly approved expense' });
    const absent = meeting({ attendance_status: 'ALL_ABSENT', attendance_present: 0, fee_eligible: false });
    const result = calculate(refreshCounters(period), [absent]);
    expect(result.slips[0].lines.find(line => line.key === absent.key)).toMatchObject({ amount: 88000, override_reason: 'Finance approved exception' });
    expect(result.slips[0].lines.find(line => line.kind === 'CLASS_SUMMARY')?.amount).toBe(230000);
    expect(result.slips[0].lines.find(line => line.key === 'component:monthly')?.amount).toBe(22000);
    expect(result.slips[0].total).toBe(750000);
    expect(calculate(result, [absent]).slips).toEqual(result.slips);
  });

  it('keeps fulltime salary and recurring allowances unchanged regardless of native attendance', () => {
    const period = applyAttendancePolicy(importedPeriod(), beforeCutover);
    const fulltime: PayrollTerm = { ...term, contract: 'FULLTIME', base_salary: 3000000, position_allowance: 100000 };
    const absent = meeting({ mode: 'FULLTIME', attendance_status: 'ALL_ABSENT', attendance_present: 0, fee_eligible: false });
    const first = calculate(period, [absent], [fulltime]);
    expect(first.slips[0].lines.filter(line => ['SALARY', 'ALLOWANCE'].includes(line.kind)).map(line => line.amount)).toEqual([100000, 3000000]);
    expect(first.slips[0].lines.find(line => line.key === absent.key)?.amount).toBe(0);
    const withPresence = calculate(first, [meeting({ mode: 'FULLTIME' })], [fulltime]);
    expect(withPresence.slips[0].lines.filter(line => ['SALARY', 'ALLOWANCE'].includes(line.kind))).toEqual(first.slips[0].lines.filter(line => ['SALARY', 'ALLOWANCE'].includes(line.kind)));
    expect(withPresence.slips[0].total).toBe(first.slips[0].total);
  });

  it('preserves frozen class buckets even if a later source refresh omits the class fee column', () => {
    const period = refreshCounters(applyAttendancePolicy(importedPeriod(), beforeCutover));
    period.legacy_imports![0].rows[0].fees = period.legacy_imports![0].rows[0].fees.filter(fee => fee.label !== 'Fee Online');
    period.legacy_imports![0].rows[0].counters = period.legacy_imports![0].rows[0].counters.filter(counter => counter.label !== 'Absen Online');
    const result = calculate(period, []);
    expect(result.slips[0].lines.find(line => line.kind === 'CLASS_SUMMARY')).toMatchObject({ quantity: 2, amount: 200000 });
    expect(result.slips[0].total).toBe(610000);
  });

  it('preserves only the frozen class baseline if a later source removes the entire coach row', () => {
    const period = refreshCounters(applyAttendancePolicy(importedPeriod(), beforeCutover));
    period.legacy_imports![0].rows = [];
    const result = calculate(period, []);
    expect(result.slips[0].lines).toHaveLength(1);
    expect(result.slips[0].lines[0]).toMatchObject({ kind: 'CLASS_SUMMARY', quantity: 2, amount: 200000 });
    expect(result.slips[0].total).toBe(200000);
    expect(calculate(result, []).slips).toEqual(result.slips);
  });

  it('keeps a partial native meeting payable for one present child but warns until the roster is complete', () => {
    const period = applyAttendancePolicy(importedPeriod(), beforeCutover);
    const partial = meeting({ attendance_status: 'PARTIAL', attendance_recorded: 1 });
    const result = calculate(period, [partial]);
    expect(result.slips[0].lines.find(line => line.key === partial.key)).toMatchObject({ amount: 100000, students: 3, attendance_status: 'PARTIAL', attendance_present: 1 });
    expect(result.warnings.some(warning => warning.includes('Absensi siswa') && warning.includes('1/3'))).toBe(true);
    const pending = calculate(result, [meeting({ attendance_status: 'PENDING', attendance_recorded: 0, attendance_present: 0, fee_eligible: false })]);
    expect(pending.slips[0].lines.find(line => line.key === partial.key)?.amount).toBe(0);
    expect(pending.warnings.some(warning => warning.includes('0/3'))).toBe(true);
    expect(pending.slips[0].lines.find(line => line.kind === 'CLASS_SUMMARY')?.amount).toBe(200000);
  });
});
