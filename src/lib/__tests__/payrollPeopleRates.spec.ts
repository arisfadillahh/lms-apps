import { describe, expect, it } from 'vitest';
import { payrollPeopleRows } from '@/lib/payroll/people';
import { payrollRateView } from '@/lib/payroll/rateView';
import { calculatePeriod, createPeriod, finalize, DEFAULT_RATES, type PayrollPerson, type PayrollTerm } from '@/lib/payroll/model';

const coach: PayrollPerson = { id: 'p', user_id: 'u', kind: 'COACH', name: 'Coach Example', job_title: 'Coach', staff_phone: null, active: true };
const term: PayrollTerm = { profile_id: 'p', effective_from: '2026-10-26', contract: 'MITRA', base_salary: 0 };
describe('recipient list and dated rates', () => {
  it('merges coach accounts without duplicating registered recipients or inventing contracts', () => {
    const rows = payrollPeopleRows([coach], [], [
      { id: 'u', full_name: coach.name, username: 'coach', is_active: true },
      { id: 'inactive', full_name: 'Inactive Coach', username: 'inactive', is_active: false },
    ], '2026-11-05');
    expect(rows).toHaveLength(2); expect(rows.every(r => r.needsSetup && r.monthly === null)).toBe(true);
    expect(rows.find(r => r.coachId === 'inactive')?.active).toBe(false);
  });
  it('supports a staff recipient without any LMS account and totals recurring allowances', () => {
    const staff: PayrollPerson = { ...coach, id: 'staff', user_id: null, kind: 'STAFF', name: 'Staff Example', job_title: 'Operator', staff_phone: '0800000000' };
    const [row] = payrollPeopleRows([staff], [{ ...term, profile_id: 'staff', contract: 'FULLTIME', base_salary: 3000000, position_allowance: 500000, other_allowances: [{ label: 'Meal', amount: 250000 }] }], [], '2026-11-05');
    expect(row.monthly).toBe(3750000); expect(row.needsSetup).toBe(false); expect(row.coachId).toBeUndefined();
  });
  it('does not count base salary for a mitra or use a future contract early', () => {
    expect(payrollPeopleRows([coach], [{ ...term, base_salary: 9000000, position_allowance: 100000 }], [], '2026-11-05')[0].monthly).toBe(100000);
    expect(payrollPeopleRows([coach], [{ ...term, effective_from: '2026-12-01' }], [], '2026-11-05')[0]).toMatchObject({ monthly: null, needsSetup: false, startsLater: '2026-12-01' });
  });
  it('marks fulltime salary as incomplete and blocks finalization until a base salary is set', () => {
    const fulltime: PayrollTerm = { ...term, contract: 'FULLTIME', base_salary: 0 };
    expect(payrollPeopleRows([coach], [fulltime], [], '2026-11-05')[0]).toMatchObject({ salaryPending: true, needsSetup: true, monthly: null });
    const now = new Date('2026-11-26T10:00:00Z');
    const incomplete = calculatePeriod({ period: createPeriod(2026, 11), people: [coach], terms: [fulltime], cards: [], activities: [], now });
    expect(incomplete.warnings).toContain('Gaji pokok fulltime belum diatur: Coach Example');
    expect(() => finalize(incomplete, 'admin', now)).toThrow(/peringatan/);
    const ready = calculatePeriod({ period: incomplete, people: [coach], terms: [{ ...fulltime, base_salary: 3000000 }], cards: [], activities: [], now });
    expect(ready.warnings).toEqual([]); expect(finalize(ready, 'admin', now).status).toBe('FINAL');
  });
  it('opens the actual active tariff, preserves history, and does not activate future rates early', () => {
    const cards = [{ effective_from: '2026-10-01', rates: { ...DEFAULT_RATES, GOAL: 110000 } }, { effective_from: '2026-12-01', rates: { ...DEFAULT_RATES, GOAL: 150000 } }];
    expect(payrollRateView(cards, '2026-11-05')).toMatchObject({ status: 'ACTIVE', date: '2026-10-01', rates: { GOAL: 110000 } });
    expect(payrollRateView(cards, '2026-11-05', '2026-12-01')).toMatchObject({ status: 'FUTURE', rates: { GOAL: 150000 } });
    expect(payrollRateView(cards, '2026-12-02', '2026-10-01').status).toBe('PAST');
    const view = payrollRateView(cards, '2026-11-05'); view.rates.WEEKLY_ONLINE[0] = 1;
    expect(cards[0].rates.WEEKLY_ONLINE[0]).toBe(70000);
    expect(payrollRateView(cards, '2026-09-01')).toMatchObject({ status: 'DEFAULT', date: null, rates: DEFAULT_RATES });
  });
});
