import { describe, expect, it } from 'vitest';
import { calculatePeriod, createPeriod, DEFAULT_RATES, finalize, recapMessage, type PayrollTerm } from '@/lib/payroll/model';
const person = { id:'staff',user_id:null,kind:'STAFF' as const,name:'Staff Demo',job_title:'Koordinator',staff_phone:null,active:true };
const term: PayrollTerm = { profile_id:person.id,effective_from:'2020-01-01',contract:'FULLTIME',base_salary:3000000,position_allowance:500000,other_allowances:[{label:'Tunjangan komunikasi',amount:100000}] };
function compute(month=11, terms=[term]) { return calculatePeriod({ period:createPeriod(2026,month),people:[person],terms,cards:[{effective_from:'2020-01-01',rates:DEFAULT_RATES}],activities:[],now:new Date(`2026-${String(month).padStart(2,'0')}-26T12:00:00+07:00`) }); }
describe('recurring staff allowances and monthly adjustments', () => {
  it('adds recurring position/custom allowances once per month without an LMS account', () => {
    const p=compute(); expect(p.slips[0].total).toBe(3600000);
    expect(p.slips[0].lines.filter(l=>l.kind==='ALLOWANCE').map(l=>l.label)).toEqual(['Tunjangan jabatan','Tunjangan komunikasi']);
    const repeated=calculatePeriod({period:p,people:[person],terms:[term],cards:[{effective_from:'2020-01-01',rates:DEFAULT_RATES}],activities:[],now:new Date('2026-11-26T13:00:00+07:00')});
    expect(repeated.slips[0].total).toBe(3600000); expect(repeated.slips[0].lines).toHaveLength(3);
  });
  it('combines recurring allowances with a specific month addition/deduction', () => {
    const period=createPeriod(2026,11); period.manual=[{id:'m1',profile_id:'staff',date:'2026-11-25T12:00:00+07:00',label:'Tunjangan kegiatan November',amount:250000,reason:'Disetujui finance'},{id:'m2',profile_id:'staff',date:'2026-11-25T12:00:00+07:00',label:'Potongan khusus November',amount:-50000,reason:'Koreksi finance'}];
    const p=calculatePeriod({period,people:[person],terms:[term],cards:[{effective_from:'2020-01-01',rates:DEFAULT_RATES}],activities:[],now:new Date('2026-11-26T12:00:00+07:00')});
    expect(p.slips[0].total).toBe(3800000); expect(compute(12).slips[0].total).toBe(3600000);
    expect(recapMessage(p,p.slips[0])).not.toContain('Tunjangan');
  });
  it('honors dated changes and preserves finalized old allowances', () => {
    const old=finalize(compute(),'admin',new Date('2026-11-26T13:00:00+07:00'));
    const changed={...term,effective_from:'2026-12-01',position_allowance:750000};
    expect(compute(11,[term,changed]).slips[0].total).toBe(3600000);
    expect(compute(12,[term,changed]).slips[0].total).toBe(3850000);
    expect(old.history[0].slips[0].total).toBe(3600000);
  });
});
