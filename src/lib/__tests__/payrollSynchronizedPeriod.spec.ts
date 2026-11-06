import { describe, expect, it } from 'vitest';
import { calculateSynchronizedPeriod } from '@/lib/payroll/synchronizedPeriod';
import { createPeriod, recapMessage, DEFAULT_RATES, type PayrollPerson, type PayrollMeeting } from '@/lib/payroll/model';
import type { LegacyPayrollSnapshot } from '@/lib/payroll/legacyImport';
import { coachPeriodView } from '@/lib/payroll/coachView';
import { attendancePeriodView } from '@/lib/payroll/attendanceView';
import { selectedMeetingKeys } from '@/lib/payroll/attendanceDetails';

const person: PayrollPerson = { id: 'p', user_id: 'u', name: 'Coach Example', kind: 'COACH', job_title: 'Coach', active: true, staff_phone: null };
const row = { sourceId: 'source', name: 'Old name', username: '@old', counters: [{ label: 'Absen Online', value: 2 }, { label: 'Absen Trial', value: 1 }], fees: [{ label: 'Fee Online', value: 200000 }, { label: 'Fee Trial', value: 25000 }], total: 225000, sourceTotal: 225000, extras: [] };
const source = { schema: 1, period: '2026-11', sourceId: 'sheet', sourceName: 'private', url: 'https://example.com/private', sourceCreatedAt: '2026-01-01T00:00:00Z', sourceModifiedAt: '2026-11-05T00:00:00Z', capturedAt: '2026-11-05T00:00:00Z', checksum: 'a'.repeat(64), rows: [row], total: 225000, totalBasis: 'SOURCE_TOTAL' } as LegacyPayrollSnapshot;
const period = () => ({ ...createPeriod(2026,11), meeting_catalog: [] as PayrollMeeting[], legacy_imports: [structuredClone(source)], legacy_links: { source: { status: 'LINKED' as const, profile_id: 'p', user_id: 'u', kind: 'COACH' as const, name: person.name, confirmed_at: source.capturedAt, reason: 'Confirmed user' } } });
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
    const message=recapMessage(p,p.slips[0]);expect(message).toContain('3 aktivitas belum memiliki tanggal');expect(message).not.toMatch(/Invalid Date|Rp|225000|200000/);
    for(const view of [coach,lead])expect(JSON.stringify(view)).not.toMatch(/225000|200000|amount|legacy_imports|checksum|sourceName/);
  });
  it('automatically recalculates quantity, preserves explicit finance amount, and survives refresh', () => {
    const p=period(); p.overrides['summary:source:Fee Online']={quantity:3,reason:'One missed meeting'};
    const first=calculateSynchronizedPeriod({...config,period:p});
    expect(first.slips[0].total).toBe(325000);
    expect(first.slips[0].lines[0]).toMatchObject({quantity:3,rate:100000,quantity_rate:100000,amount:300000});
    first.legacy_imports![0].rows[0].counters[0].value=4; first.legacy_imports![0].rows[0].fees[0].value=400000;
    expect(calculateSynchronizedPeriod({...config,period:first}).slips[0].total).toBe(325000);
    first.overrides['summary:source:Fee Online'].amount=350000;
    expect(calculateSynchronizedPeriod({...config,period:first}).slips[0].total).toBe(375000);
    first.overrides['summary:source:Fee Online']={quantity:0,reason:'All classes cancelled'};
    expect(calculateSynchronizedPeriod({...config,period:first}).slips[0].total).toBe(25000);
  });
  it('rounds the final corrected amount without repeatedly rounding the unit price', () => {
    const p=period(); p.legacy_imports![0].rows[0].counters[0].value=3;p.legacy_imports![0].rows[0].fees[0].value=100000;
    p.overrides['summary:source:Fee Online']={quantity:6,reason:'Six verified sessions'};
    expect(calculateSynchronizedPeriod({...config,period:p}).slips[0].lines[0].amount).toBe(200000);
  });
  it('uses configured tariff when adding a previously empty activity count', () => {
    const p=period();p.legacy_imports![0].rows[0].counters[1].value=0;p.legacy_imports![0].rows[0].fees[1].value=0;
    p.overrides['summary:source:Fee Trial']={quantity:2,reason:'Two missing trial sessions'};
    const slip=calculateSynchronizedPeriod({...config,period:p}).slips[0];expect(slip.lines[1].amount).toBe(50000);expect(slip.lines[1].quantity_rate).toBe(25000);
  });
  it('records added fulltime trials without a trial fee, while explicit finance exceptions remain explicit', () => {
    const p=period();p.legacy_imports![0].rows[0].counters[1].value=0;p.legacy_imports![0].rows[0].fees[1].value=0;
    p.overrides['summary:source:Fee Trial']={quantity:2,reason:'Two actual trial sessions'};
    const terms=[{...config.terms[0],contract:'FULLTIME' as const,base_salary:3000000}];
    let result=calculateSynchronizedPeriod({...config,terms,period:p});expect(result.slips[0].lines.find(l=>l.kind==='TRIAL')).toMatchObject({quantity:2,amount:0,quantity_rate:0});
    p.overrides['summary:source:Fee Trial'].amount=50000;
    result=calculateSynchronizedPeriod({...config,terms,period:p});expect(result.slips[0].lines.find(l=>l.kind==='TRIAL')!.amount).toBe(50000);
  });
  it('requires exact dated evidence, never takes an arbitrary subset, and honors selected real meetings', () => {
    const p=period(); const meeting=(key:string,date:string) => ({key,date,label:'Robotics class',user_id:'u',kind:'WEEKLY' as const,delivery:'ONLINE' as const,students:3,cancelled:false});
    p.meeting_catalog=[meeting('session:a','2026-11-01T08:00:00Z'),meeting('session:b','2026-11-02T08:00:00Z'),meeting('session:c','2026-11-03T08:00:00Z')];
    const ambiguous=calculateSynchronizedPeriod({...config,period:p}).slips[0];expect(ambiguous.attendance_details).toEqual([]);expect(ambiguous.unresolved_attendance).toBe(3);
    p.overrides['summary:source:Fee Online']={quantity:2,meeting_keys:['session:a','session:c'],reason:'Confirmed actual meetings'};
    p.overrides['summary:source:Fee Trial']={quantity:0,reason:'Trial was cancelled'};
    const matched=calculateSynchronizedPeriod({...config,period:p}).slips[0];expect(matched.attendance_details!.map(m=>m.key)).toEqual(['session:a','session:c']);expect(matched.unresolved_attendance).toBe(0);
    expect(recapMessage(p,matched)).toContain('Robotics class');expect(recapMessage(p,matched)).not.toMatch(/Rp|100000/);
  });
  it('keeps new sessions after an operational correction instead of freezing the monthly count',()=>{
    const p=period();const key='summary:source:Fee Online';
    p.overrides[key]={quantity:1,quantity_delta:-1,meeting_keys:['source:a'],selection_cutoff:'2026-11-02T15:00:00Z',reason:'One class cancelled'};
    p.overrides['summary:source:Fee Trial']={quantity:0,reason:'Trial cancelled'};
    const meeting=(id:string,day:number):PayrollMeeting=>({key:'source:'+id,date:`2026-11-0${day}T08:00:00Z`,label:'Robotics',user_id:'u',kind:'WEEKLY',delivery:'ONLINE',students:3,cancelled:false,origin:'SOURCE',source_identity:'source',source_counter:'Absen Online',mode:'MITRA'});
    p.meeting_catalog=[meeting('a',1),meeting('b',2)];
    let result=calculateSynchronizedPeriod({...config,period:p});expect(result.slips[0].lines[0]).toMatchObject({quantity:1,amount:100000});
    p.legacy_imports![0].rows[0].counters[0].value=3;p.legacy_imports![0].rows[0].fees[0].value=300000;p.meeting_catalog.push(meeting('c',3));
    result=calculateSynchronizedPeriod({...config,period:p});expect(result.slips[0].lines[0]).toMatchObject({quantity:2,amount:200000});expect(result.slips[0].attendance_details!.map(m=>m.key)).toEqual(['source:a','source:c']);expect(result.slips[0].unresolved_attendance).toBe(0);
    expect(selectedMeetingKeys(p.overrides[key],p.meeting_catalog,result.slips[0].lines[0],'u')).toEqual(['source:a','source:c']);
  });
  it('uses proven source identities and counters and waits for a known later class before listing attendance',()=>{
    const p=period();p.overrides['summary:source:Fee Trial']={quantity:0,reason:'No trial activities'};
    const meeting=(key:string,date:string):PayrollMeeting=>({key,date,label:'Robotics',user_id:'u',kind:'WEEKLY',delivery:'ONLINE',students:3,cancelled:false,origin:'SOURCE',source_identity:'source',source_counter:'Absen Online',mode:'MITRA'});
    p.meeting_catalog=[meeting('a','2026-11-04T08:00:00Z'),meeting('b','2026-11-05T12:00:00Z'),{...meeting('wrong','2026-11-02T08:00:00Z'),source_identity:'other'},{...meeting('native','2026-11-03T08:00:00Z'),origin:undefined,source_identity:undefined,source_counter:undefined}];
    let slip=calculateSynchronizedPeriod({...config,period:p}).slips[0];expect(slip.unresolved_attendance).toBe(0);expect(slip.attendance_details!.map(m=>m.key)).toEqual(['a']);
    slip=calculateSynchronizedPeriod({...config,now:new Date('2026-11-05T14:00:00Z'),period:p}).slips[0];expect(slip.attendance_details!.map(m=>m.key)).toEqual(['a','b']);
  });
  it('adds native goals and observations absent from the source without duplicating represented class/trial counters',()=>{
    const p=period();const activity={key:'goal:a',user_id:'u',date:'2026-11-02T08:00:00Z',label:'Trial goal',kind:'GOAL' as const,mode:'MITRA' as const,delivery:'ONLINE' as const,students:1,cancelled:false};
    const activities=[activity,{...activity,key:'observation:a',kind:'OBSERVATION_ONLINE' as const,label:'Observation'},{...activity,key:'native-class',kind:'WEEKLY' as const},{...activity,key:'native-trial',kind:'TRIAL' as const}];
    const result=calculateSynchronizedPeriod({...config,period:p,activities});expect(result.slips[0].total).toBe(350000);expect(result.slips[0].lines.filter(l=>l.kind==='TRIAL')).toHaveLength(1);
    expect(calculateSynchronizedPeriod({...config,period:result,activities}).slips[0].total).toBe(350000);
    expect(calculateSynchronizedPeriod({...config,period:result}).slips[0].total).toBe(350000);
    expect(calculateSynchronizedPeriod({...config,period:result,activities:[]}).slips[0].total).toBe(225000);
  });
});
