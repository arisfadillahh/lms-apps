import { describe, expect, it } from 'vitest';
import { calculateSynchronizedPeriod } from '@/lib/payroll/synchronizedPeriod';
import { createPeriod, recapMessage, DEFAULT_RATES, type PayrollPerson } from '@/lib/payroll/model';
import type { LegacyPayrollSnapshot } from '@/lib/payroll/legacyImport';
import { coachPeriodView } from '@/lib/payroll/coachView';
import { attendancePeriodView } from '@/lib/payroll/attendanceView';

const person: PayrollPerson = { id: 'p', user_id: 'u', name: 'Coach Example', kind: 'COACH', job_title: 'Coach', active: true, staff_phone: null };
const row = { sourceId: 'source', name: 'Old name', username: '@old', counters: [{ label: 'Absen Online', value: 2 }, { label: 'Absen Trial', value: 1 }], fees: [{ label: 'Fee Online', value: 200000 }, { label: 'Fee Trial', value: 25000 }], total: 225000, sourceTotal: 225000, extras: [] };
const source = { schema: 1, period: '2026-11', sourceId: 'sheet', sourceName: 'private', url: 'https://example.com/private', sourceCreatedAt: '2026-01-01T00:00:00Z', sourceModifiedAt: '2026-11-05T00:00:00Z', capturedAt: '2026-11-05T00:00:00Z', checksum: 'a'.repeat(64), rows: [row], total: 225000, totalBasis: 'SOURCE_TOTAL' } as LegacyPayrollSnapshot;
const period = () => ({ ...createPeriod(2026,11), legacy_imports: [structuredClone(source)], legacy_links: { source: { status: 'LINKED' as const, profile_id: 'p', user_id: 'u', kind: 'COACH' as const, name: person.name, confirmed_at: source.capturedAt, reason: 'Confirmed user' } } });
const config = { people: [person], terms: [{ profile_id: 'p', effective_from: '2026-10-26', contract: 'MITRA' as const, base_salary: 0 }], cards: [{ effective_from: '2026-10-26', rates: DEFAULT_RATES }], now: new Date('2026-11-05T10:00:00Z'), includeRecurring: true };
describe('one synchronized LMS payroll ledger', () => {
  it('makes ordinary recipient slips with activity quantities and no invented session dates', () => {
    const p = period(), result = calculateSynchronizedPeriod({ ...config, period: p });
    expect(result.slips).toHaveLength(1); expect(result.slips[0].name).toBe(person.name); expect(result.slips[0].total).toBe(225000);
    expect(result.slips[0].lines.map(l => [l.quantity,l.date])).toEqual([[2,''],[1,'']]); expect(p.slips).toEqual([]);
    expect(result.legacy_imports).toEqual(p.legacy_imports); expect(result.transfers).toEqual([]); expect(result.deliveries).toEqual({});
  });
  it('replaces refreshed cumulative totals rather than adding the same activities again', () => {
    const first = calculateSynchronizedPeriod({ ...config, period: period() });
    expect(calculateSynchronizedPeriod({ ...config, period: first }).slips).toEqual(first.slips);
    first.legacy_imports![0].rows[0].fees[0].value=300000;first.legacy_imports![0].rows[0].counters[0].value=3;
    const updated=calculateSynchronizedPeriod({ ...config, period:first });
    expect(updated.slips[0].total).toBe(325000); expect(updated.slips[0].lines[0].quantity).toBe(3);
  });
  it('retains period adjustments and component overrides across synchronization', () => {
    const p=period();p.manual.push({id:'extra',profile_id:'p',date:'2026-11-03T00:00:00Z',label:'Transport',amount:50000,reason:'Approved exception'});
    p.overrides['summary:source:Fee Trial']={amount:30000,reason:'Correct fee'};
    const result=calculateSynchronizedPeriod({...config,period:p});expect(result.slips[0].total).toBe(280000);
    expect(calculateSynchronizedPeriod({...config,period:result}).slips[0].total).toBe(280000);
  });
  it('adds recurring salary once in the current period and never inserts current salary into old archives', () => {
    const terms=[{...config.terms[0],contract:'FULLTIME' as const,base_salary:3000000,position_allowance:100000}];
    const result=calculateSynchronizedPeriod({...config,terms,period:period()});expect(result.slips[0].total).toBe(3325000);
    expect(calculateSynchronizedPeriod({...config,terms,period:result}).slips[0].total).toBe(3325000);
    expect(calculateSynchronizedPeriod({...config,terms,includeRecurring:false,period:period()}).slips[0].total).toBe(225000);
  });
  it('keeps inactive recipients with recorded activity without reactivating their accounts', () => {
    const people=[{...person,active:false}];expect(calculateSynchronizedPeriod({...config,people,period:period()}).slips[0].total).toBe(225000);expect(people[0].active).toBe(false);
  });
  it('ignores explicitly excluded source identities and rejects missing or changed mappings', () => {
    const p=period();p.legacy_links.source={status:'IGNORED',confirmed_at:source.capturedAt,reason:'Excluded'} as never;
    expect(calculateSynchronizedPeriod({...config,includeRecurring:false,period:p}).slips).toEqual([]);
    expect(()=>calculateSynchronizedPeriod({...config,period:{...period(),legacy_links:{}}})).toThrow(/belum dipasangkan/);
    expect(()=>calculateSynchronizedPeriod({...config,people:[{...person,user_id:'wrong'}],period:period()})).toThrow(/Identitas/);
  });
  it('uses one closing archive version, supports multiple confirmed identities for one coach, and preserves final versions', () => {
    const p=period();p.legacy_imports!.unshift({...source,sourceId:'earlier',sourceCreatedAt:'2025-01-01T00:00:00Z'});
    const second={...row,sourceId:'second'};p.legacy_imports![1].rows.push(second);p.legacy_links['second' as 'source']={...p.legacy_links.source};
    const result=calculateSynchronizedPeriod({...config,period:p});expect(result.slips).toHaveLength(1);expect(result.slips[0].total).toBe(450000);
    expect(()=>calculateSynchronizedPeriod({...config,period:{...p,status:'FINAL'}})).toThrow(/revisi/);
  });
  it('exposes activity counts without nominal or source connection details to coaches and leads', () => {
    const p=calculateSynchronizedPeriod({...config,period:period()});
    const coach=coachPeriodView(p,'u'),lead=attendancePeriodView({id:p.id,revision:1,document:p});
    expect(coach?.activities[0].quantity).toBe(2);expect(lead.activities[0].quantity).toBe(2);
    const message=recapMessage(p,p.slips[0]);expect(message).toContain('3 aktivitas tercatat');expect(message).not.toMatch(/Invalid Date|Rp|225000|200000/);
    for(const view of [coach,lead])expect(JSON.stringify(view)).not.toMatch(/225000|200000|amount|legacy_imports|checksum|sourceName/);
  });
});
