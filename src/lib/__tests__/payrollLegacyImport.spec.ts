import { describe, it, expect } from 'vitest';
import { parseLegacySheet, legacyArchivePeriod, latestLegacySnapshot, mergeLegacySnapshots, withoutUnlabelledExtras, type LegacySheetSource } from '@/lib/payroll/legacyImport';
import { calculatePeriod, createPeriod } from '@/lib/payroll/model';
import { coachPeriodView } from '@/lib/payroll/coachView';
import { attendancePeriodView } from '@/lib/payroll/attendanceView';

const checksum = 'a'.repeat(64);
function source(): LegacySheetSource {
  const rows = [['Coach ID','Name','Username','Absen Online','Absen Trial','Fee Online','Fee Trial','Total Estimasi'],[123,'Coach Example','@example',2,1,200000,25000,225000]];
  return {file:{id:'example',name:'Rekap Gaji October 2026',createdTime:'2026-10-25T10:00:00Z',modifiedTime:'2026-10-26T10:00:00Z'},capturedAt:'2026-11-05T08:00:00Z',cells:{spreadsheetId:'example',sheets:[{properties:{title:'ID Coaches'},data:[{rowData:rows.map(row=>({values:row.map(v=>({effectiveValue:typeof v==='number'?{numberValue:v}:{stringValue:v}}))}))}]}]}};
}
describe('legacy payroll import',()=>{
  it('keeps original quantities and nominal without making payable activities',()=>{
    const snapshot=parseLegacySheet(source(),checksum);
    expect(snapshot.period).toBe('2026-10'); expect(snapshot.total).toBe(225000);
    expect(snapshot.rows[0].counters.map(c=>c.value)).toEqual([2,1]);
    const p=mergeLegacySnapshots(createPeriod(2026,10),[snapshot]);
    expect(p.slips).toEqual([]); expect(p.activities).toEqual([]); expect(p.transfers).toEqual([]); expect(p.deliveries).toEqual({});
  });
  it('refuses mismatched totals, duplicate identities and source IDs',()=>{
    const s=source(); s.cells.sheets[0].data![0].rowData![1].values![7].effectiveValue={numberValue:1};
    expect(()=>parseLegacySheet(s,checksum)).toThrow('Jumlah komponen');
    const dup=source(); dup.cells.sheets[0].data![0].rowData!.push(dup.cells.sheets[0].data![0].rowData![1]);
    expect(()=>parseLegacySheet(dup,checksum)).toThrow('duplikat');
    const wrong=source(); wrong.cells.spreadsheetId='other'; expect(()=>parseLegacySheet(wrong,checksum)).toThrow('Identitas file');
  });
  it('preserves blank amounts and explicitly derives a total only from recorded fees',()=>{
    const s=source(), rows=s.cells.sheets[0].data![0].rowData!;
    rows.forEach(row=>row.values!.pop()); rows[1].values![6]={};
    const result=parseLegacySheet(s,checksum);
    expect(result.totalBasis).toBe('RECORDED_FEES'); expect(result.rows[0].fees[1].value).toBeNull(); expect(result.total).toBe(200000);
  });
  it('handles blank totals and Indonesian rupiah text without assigning new rates',()=>{
    const s=source(), row=s.cells.sheets[0].data![0].rowData![1].values!;
    row[7]={}; row[5]={effectiveValue:{stringValue:'Rp.200.000,-'}};
    const result=parseLegacySheet(s,checksum);
    expect(result.totalBasis).toBe('MIXED'); expect(result.total).toBe(225000); expect(result.rows[0].sourceTotal).toBeNull();
  });
  it('keeps unlabeled extra amounts separate from the source total',()=>{
    const s=source(); s.cells.sheets[0].data![0].rowData![1].values!.push({effectiveValue:{numberValue:200000},userEnteredValue:{formulaValue:'=H2-25000'}});
    const result=parseLegacySheet(s,checksum);
    expect(result.total).toBe(225000); expect(result.rows[0].extras[0]).toMatchObject({cell:'I2',value:200000,formula:'=H2-25000'});
  });
  it('rejects spreadsheet errors and unsafe periods',()=>{
    const s=source(); s.cells.sheets[0].data![0].rowData![1].values![5]={effectiveValue:{errorValue:{type:'REF'}}};
    expect(()=>parseLegacySheet(s,checksum)).toThrow('Angka sumber');
    expect(()=>legacyArchivePeriod('test gaji')).toThrow();
    expect(legacyArchivePeriod('November 2025')).toBe('2025-11');
  });
  it('can ignore unlabelled manual columns while retaining source totals and audit coordinates',()=>{
    const s=source(); s.cells.sheets[0].data![0].rowData![1].values!.push({effectiveValue:{numberValue:200000}});
    const result=withoutUnlabelledExtras(parseLegacySheet(s,checksum));
    expect(result.total).toBe(225000); expect(result.rows[0].extras).toEqual([]); expect(result.rows[0].ignoredExtraCells).toEqual(['I2']);
  });
  it('retains alternate archives once, selects the closing copy, and is idempotent',()=>{
    const late=parseLegacySheet(source(),checksum);
    const early={...late,sourceId:'early',sourceCreatedAt:'2026-10-03T10:00:00Z',total:100};
    const p=createPeriod(2026,10); p.pic_id='existing-pic'; p.manual=[{id:'existing',profile_id:'p',date:p.starts_at,label:'Existing adjustment',amount:1,reason:'Keep existing'}];
    const merged=mergeLegacySnapshots(p,[early,late]);
    expect(latestLegacySnapshot(merged.legacy_imports!)?.total).toBe(225000);
    expect(mergeLegacySnapshots(merged,[early,late])).toEqual(merged);
    expect(merged.manual).toEqual(p.manual); expect(merged.pic_id).toBe(p.pic_id);
    expect(()=>mergeLegacySnapshots(createPeriod(2026,11),[late])).toThrow('Periode');
  });
  it('survives LMS recalculation without adding old counters or leaking finance to operational views',()=>{
    const p=mergeLegacySnapshots(createPeriod(2026,10),[parseLegacySheet(source(),checksum)]);
    const result=calculatePeriod({period:p,people:[],terms:[],cards:[],activities:[]});
    expect(result.legacy_imports).toEqual(p.legacy_imports); expect(result.slips).toEqual([]);
    expect(coachPeriodView(result,'any')).toBeNull();
    expect(JSON.stringify(attendancePeriodView({id:p.id,revision:1,document:result}))).not.toContain('legacy_imports');
    expect(JSON.stringify(attendancePeriodView({id:p.id,revision:1,document:result}))).not.toContain('225000');
  });
});
