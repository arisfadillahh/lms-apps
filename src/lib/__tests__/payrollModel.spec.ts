import { describe, expect, it } from 'vitest';
import { calculatePeriod, createPeriod, currentPeriod, DEFAULT_RATES, finalize, reopen, markTransferred, isPaid, correctionOpen, recapMessage, validateRates, type PayrollPerson, type PayrollTerm, type Activity } from '@/lib/payroll/model';

const people: PayrollPerson[] = [
  { id: 'p1', user_id: 'u1', name: 'Coach mitra', kind: 'COACH', job_title: 'Coach', active: true, staff_phone: null },
  { id: 'p2', user_id: 'u2', name: 'Coach fulltime', kind: 'COACH', job_title: 'Coach', active: true, staff_phone: null },
  { id: 'p3', user_id: null, name: 'Staf lokal', kind: 'STAFF', job_title: 'Operasional', active: true, staff_phone: null },
];
const terms: PayrollTerm[] = people.map((p, i) => ({ profile_id: p.id, effective_from: '2026-01-01', contract: i === 0 ? 'MITRA' : 'FULLTIME', base_salary: i === 0 ? 0 : 3000000 }));
const now = new Date('2026-11-26T01:00:00Z');
const activity = (patch: Partial<Activity> = {}): Activity => ({ key: 's1', user_id: 'u1', date: '2026-11-25T19:00:00+07:00', label: 'Kelas', kind: 'WEEKLY', delivery: 'ONLINE', mode: 'MITRA', students: 2, cancelled: false, ...patch });
function calc(activities: Activity[] = [], period = createPeriod(2026, 11), cards = [{ effective_from: '2026-01-01', rates: structuredClone(DEFAULT_RATES) }]) { return calculatePeriod({ period, people, terms, activities, cards, now }); }

describe('payroll calendar and automatic fee policy', () => {
  it('keeps all of the 25th and starts a fresh period at midnight WIB on the 26th', () => {
    expect(currentPeriod(new Date('2026-11-25T23:59:59+07:00')).id).toBe('2026-11');
    expect(currentPeriod(new Date('2026-11-26T00:00:00+07:00')).id).toBe('2026-12');
    const p = calc([activity(), activity({ key: 'next', date: '2026-11-26T00:00:00+07:00' })]);
    expect(p.slips[1].lines.filter(l => l.kind === 'WEEKLY')).toHaveLength(1);
    expect(p.ends_at).toBe('2026-11-25T17:00:00.000Z');
  });
  it('handles the December/January year boundary', () => { expect(currentPeriod(new Date('2026-12-26T00:00:00+07:00')).id).toBe('2027-01'); expect(createPeriod(2027, 1).starts_at).toBe('2026-12-25T17:00:00.000Z'); });
  it.each([[1, 70000], [2, 80000], [3, 100000], [10, 100000]])('rates online class with %i enrolled children at %i', (students, amount) => { expect(calc([activity({ students })]).slips.find(s => s.profile_id === 'p1')!.total).toBe(amount); });
  it('distinguishes Weekly/Ekskul and delivery mode through effective rate cards', () => {
    const rates = structuredClone(DEFAULT_RATES); rates.EKSKUL_OFFLINE[1] = 160000;
    expect(calc([activity({ kind: 'EKSKUL', delivery: 'OFFLINE' })], undefined, [{ effective_from: '2026-01-01', rates }]).slips.find(s => s.profile_id === 'p1')!.total).toBe(160000);
  });
  it('does not give extra teaching fee to fulltime mode, but does for mitra mode', () => {
    expect(calc([activity({ user_id: 'u2', mode: 'FULLTIME' })]).slips.find(s => s.profile_id === 'p2')!.total).toBe(3000000);
    expect(calc([activity({ user_id: 'u2', mode: 'MITRA' })]).slips.find(s => s.profile_id === 'p2')!.total).toBe(3080000);
  });
  it('fulltime gets conversion bonus but never the ordinary trial fee', () => {
    const p = calc([activity({ key: 'trial', user_id: 'u2', kind: 'TRIAL' }), activity({ key: 'goal', user_id: 'u2', kind: 'GOAL' })]);
    expect(p.slips.find(s => s.profile_id === 'p2')!.total).toBe(3100000);
  });
  it('pays one trial fee and five independent child bonuses', () => {
    const p = calc([activity({ key: 'trial', kind: 'TRIAL', students: 5 }), ...Array.from({ length: 5 }, (_, i) => activity({ key: `goal:${i}`, kind: 'GOAL' }))]);
    expect(p.slips.find(s => s.profile_id === 'p1')!.total).toBe(525000);
  });
  it('does not pay cancelled activities; a documented admin amount can compensate force majeure', () => {
    const p = createPeriod(2026, 11); p.overrides.s1 = { amount: 50000, reason: 'Kompensasi force majeure disetujui admin' };
    expect(calc([activity({ cancelled: true })]).slips.find(s => s.profile_id === 'p1')!.total).toBe(0);
    expect(calc([activity({ cancelled: true })], p).slips.find(s => s.profile_id === 'p1')!.total).toBe(50000);
  });
  it('admin can redirect a session to another recipient and set its compensation mode', () => {
    const p = createPeriod(2026, 11); p.overrides.s1 = { profile_id: 'p2', mode: 'MITRA', reason: 'Pengganti mendadak oleh admin' };
    const result = calc([activity()], p);
    expect(result.slips.find(s => s.profile_id === 'p1')!.total).toBe(0);
    expect(result.slips.find(s => s.profile_id === 'p2')!.total).toBe(3080000);
  });
  it('recalculating and repeated source rows never duplicate fee', () => {
    const p = calc([activity(), activity()]); expect(calc([activity(), activity()], p)).toEqual(p);
  });
  it('uses the tariff effective on activity date instead of the newest tariff', () => {
    const rates = structuredClone(DEFAULT_RATES); rates.WEEKLY_ONLINE[1] = 999999;
    const p = calc([activity()], undefined, [{ effective_from: '2026-01-01', rates: DEFAULT_RATES }, { effective_from: '2026-12-01', rates }]);
    expect(p.slips.find(s => s.profile_id === 'p1')!.total).toBe(80000);
  });
  it('requires configuration instead of silently applying unknown contracts', () => { const p = calculatePeriod({ period: createPeriod(2026, 11), people, terms: [], cards: [], activities: [activity()], now }); expect(p.warnings.length).toBeGreaterThan(0); expect(() => finalize(p, 'admin', now)).toThrow(); });
  it('keeps a staff salary and manual transport/deductions separate from teaching', () => {
    const p = createPeriod(2026, 11); p.manual.push({ id: 'm', profile_id: 'p3', date: '2026-11-25T00:00:00Z', amount: -50000, label: 'Potongan', reason: 'Koreksi admin' });
    expect(calc([], p).slips.find(s => s.profile_id === 'p3')!.total).toBe(2950000);
  });
  it('refuses non-integer/negative rates and impossible calendar periods', () => { expect(() => validateRates({ ...DEFAULT_RATES, GOAL: -1 })).toThrow(); expect(() => validateRates({ ...DEFAULT_RATES, GOAL: 1.5 })).toThrow(); expect(() => createPeriod(2026, 13)).toThrow(); });
});

describe('monthly final versions and bank transfer ledger', () => {
  it('requires a calculation after the complete 25th before finalizing', () => { const p = calc(); expect(() => finalize(p, 'admin', new Date('2026-11-25T17:00:00+07:00'))).toThrow(); p.calculated_at = '2026-11-25T09:00:00+07:00'; expect(() => finalize(p, 'admin', now)).toThrow(); });
  it('keeps final snapshots immutable when terms/rates and the next draft change', () => {
    const final = finalize(calc([activity()]), 'admin', now); const original = structuredClone(final.history[0]);
    const draft = reopen(final, 'Koreksi setelah tanggal 25'); draft.overrides.s1 = { amount: 90000, reason: 'Koreksi fee kelas' };
    const next = finalize(calc([activity()], draft), 'admin', now);
    expect(next.version).toBe(2); expect(next.history[0]).toEqual(original); expect(next.history[1].slips.find(s => s.profile_id === 'p1')!.total).toBe(90000);
  });
  it('preserves transfer history after a revision and requires only the difference', () => {
    let p = markTransferred(finalize(calc([activity()]), 'admin', now), ['p1'], 'admin', 'TF bank', now);
    expect(isPaid(p, 'p1')).toBe(true); const old = structuredClone(p.transfers);
    p = reopen(p, 'Ada sesi tambahan'); p.overrides.s1 = { amount: 100000, reason: 'Perbaikan fee' };
    p = finalize(calc([activity()], p), 'admin', now); expect(p.transfers).toEqual(old); expect(isPaid(p, 'p1')).toBe(false);
    p = markTransferred(p, ['p1', 'p1'], 'admin', 'TF selisih', now);
    expect(p.transfers.map(t => t.amount)).toEqual([80000, 20000]); expect(isPaid(p, 'p1')).toBe(true);
    expect(markTransferred(p, ['p1'], 'admin', '', now).transfers).toHaveLength(2);
  });
  it('does not lose an already-transferred recipient when their profile is disabled', () => {
    const p = markTransferred(finalize(calc([activity()]), 'admin', now), ['p1'], 'admin', '', now);
    const d = reopen(p, 'Audit penerima lama');
    const r = calculatePeriod({ period: d, people: people.filter(p => p.id !== 'p1'), terms, cards: [{ effective_from: '2026-01-01', rates: DEFAULT_RATES }], activities: [], now });
    expect(r.slips.find(s => s.profile_id === 'p1')).toBeDefined(); expect(r.transfers).toHaveLength(1);
  });
  it('prevents transfer before finalization and revisions during document delivery', () => {
    const p = calc(); expect(() => markTransferred(p, ['p1'], 'admin', '', now)).toThrow();
    p.deliveries.x = { token: 'x', profile_id: 'p1', kind: 'SLIP', status: 'SENDING', version: 1, at: now.toISOString() };
    expect(() => finalize(p, 'admin', now)).toThrow();
  });
  it('closes regular coach reports exactly at 17.00 but allows admin revision afterward', () => {
    const p = calc(); expect(correctionOpen(p, new Date('2026-11-25T16:59:59+07:00'))).toBe(true); expect(correctionOpen(p, new Date('2026-11-25T17:00:00+07:00'))).toBe(false);
    expect(reopen(finalize(p, 'admin', now), 'Revisi admin akhir bulan').status).toBe('DRAFT');
    expect(recapMessage(p, p.slips[0], now)).toContain('PUKUL 17.00 WIB');
  });
});
