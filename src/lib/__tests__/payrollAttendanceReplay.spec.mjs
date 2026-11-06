import { describe, it, expect } from 'vitest';
import { allocateSourceMeetings, COUNTERS, sourceBucket, sourceTime, summarizeSourceRuns, verifySourceRun } from '../../../scripts/lib/payroll-attendance-replay.mjs';

const report = (id = 201) => ({ 'Coach ID': id, Username: `synthetic-${id}`, ...Object.fromEntries(COUNTERS.map(key => [key, 0])) });
const session = (extra = {}) => ({ row_number: 8, CoachID: 201, Hari: 'Senin', Jam: '15:00', Tipe: 'Weekly', NamaKelas: 'Synthetic robotics', Status: 'Masuk', 'Online/Offline': 'Online', 'Jenis Kelas': 1, ...extra });
const absence = (extra = {}) => ({ row_number: 3, CoachID: 201, PenggantiID: 202, Hari: 'Senin', Jam: '15:00', Status: 'Izin', Tanggal: '2026-11-02', ...extra });
const input = (items) => ({ items, at: '2026-11-02T02:00:00.000Z', timezone: 'Asia/Jakarta', specialCoachIds: [101, 102], executionId: 'synthetic-run' });

// Small independent reviewed-code fixture; it only models normal class increments.
const reviewed = `
const specialCoaches = [101, 102];
const day = new Date().toLocaleDateString('id-ID', {weekday:'long'});
const reports = items.map(i=>i.json).filter(i=>i['Coach ID']);
for(const item of items){const j=item.json;if(j.Status!=='Masuk'||j.Hari!==day)continue;
const r=reports.find(x=>x['Coach ID']===j.CoachID);if(!r)continue;
if(!specialCoaches.includes(j.CoachID)||j.NamaKelas.toLowerCase().includes('(mitra)')){
const d=j['Online/Offline'];if(d==='Online'||d==='Offline')r['Absen '+d+(j['Jenis Kelas']===1?' 1':j['Jenis Kelas']===2?' 2':'')]++;}
if(j.Tranportasi==='Motor')r['Transport-Motor']++;}
return reports.map(json=>({json}));`;
function verifiable(extra = {}) {
  const after = report(); after['Absen Online 1'] = 1;
  return { ...input([report(), session()]), code: reviewed, taskCount: 1, storedOutput: [after], writerOutput: [after], writerSucceeded: true, sourceWeekday: 'Senin', ...extra };
}

describe('retained source attendance replay', () => {
  it('uses the recorded run date plus the actual schedule clock, without replacing source headcount buckets', () => {
    const output = allocateSourceMeetings(input([report(), session()]));
    expect(output.meetings[0]).toMatchObject({ sourceCoachId: '201', date: '2026-11-02T08:00:00.000Z', kind: 'WEEKLY', studentsBucket: 1, bucket: 'Absen Online 1', sourceRow: 8, mode: 'MITRA' });
    expect(output.after[0]['Absen Online 1']).toBe(1); expect(output.before[0]['Absen Online 1']).toBe(0);
    expect(output.meetings[0].provenance).toMatchObject({ executionId: 'synthetic-run', inputIndex: 1, originalScheduleInputIndex: 1 });
  });
  it('preserves the source strict numeric headcount rules', () => {
    expect(sourceBucket('Online', 1)).toBe('Absen Online 1');
    expect(sourceBucket('Offline', 2)).toBe('Absen Offline 2');
    expect(sourceBucket('Online', '1')).toBe('Absen Online');
    expect(sourceBucket('Offline', '2')).toBe('Absen Offline');
    const output = allocateSourceMeetings(input([report(), session({ 'Jenis Kelas': '1' })]));
    expect(output.meetings[0].studentsBucket).toBe(3);
  });
  it('counts a special coach only for an explicitly marked mitra class, preserving source transport separately', () => {
    const covered = allocateSourceMeetings(input([report(101), session({ CoachID: 101, Tranportasi: 'Motor' })]));
    expect(covered.meetings).toEqual([]); expect(covered.after[0]['Transport-Motor']).toBe(1);
    expect(covered.skipped.salary_covered).toBe(1);
    const paid = allocateSourceMeetings(input([report(101), session({ CoachID: 101, NamaKelas: 'Synthetic (Mitra)' })]));
    expect(paid.meetings).toHaveLength(1);
  });
  it('does not coerce source coach IDs before strict source matching', () => {
    const output = allocateSourceMeetings(input([report('101'), session({ CoachID: '101' })]));
    expect(output.meetings).toHaveLength(1);
    expect(allocateSourceMeetings(input([report(201), session({ CoachID: '201' })])).meetings).toEqual([]);
  });
  it('removes the original teacher and allocates a dated approved substitute with inherited delivery and bucket', () => {
    const output = allocateSourceMeetings(input([report(), report(202), session({ 'Online/Offline': 'Offline', 'Jenis Kelas': 2, Tipe: 'Ekskul' }), absence()]));
    expect(output.meetings).toHaveLength(1);
    expect(output.meetings[0]).toMatchObject({ sourceCoachId: '202', substitute: true, delivery: 'OFFLINE', studentsBucket: 2, kind: 'EKSKUL', label: 'Synthetic robotics' });
    expect(output.meetings[0].provenance.leaveRow).toBe(3);
    expect(output.after[0]['Absen Offline 2']).toBe(0); expect(output.after[1]['Absen Offline 2']).toBe(1);
  });
  it('ignores leave from a different date and does not create unpaid cancelled sessions', () => {
    const output = allocateSourceMeetings(input([report(), report(202), session(), absence({ Tanggal: '2026-11-01' }), session({ row_number: 9, Status: 'Batal' })]));
    expect(output.meetings).toHaveLength(1); expect(output.meetings[0].sourceCoachId).toBe('201');
  });
  it('keeps ambiguous replacement evidence unresolved instead of inventing its class', () => {
    const output = allocateSourceMeetings(input([report(), report(202), session(), session({ row_number: 9, NamaKelas: 'Another class' }), absence()]));
    expect(output.meetings).toEqual([]); expect(output.unresolved[0].reasons).toContain('ambiguous_original_schedule');
    expect(output.after[1]['Absen Online 1']).toBe(1);
  });
  it('does not invent a class label when a substitute has no original schedule snapshot', () => {
    const output = allocateSourceMeetings(input([report(202), absence({ 'Online/Offline': 'Online', 'Jenis Kelas': 1 })]));
    expect(output.meetings).toEqual([]); expect(output.unresolved[0].reasons).toContain('missing_class_label');
  });
  it('accepts actual spreadsheet clock formats and refuses unsupported numeric hours', () => {
    expect(sourceTime('9:05')).toBe('09:05:00'); expect(sourceTime('19.30')).toBe('19:30:00');
    expect(sourceTime(0.5)).toBe('12:00:00'); expect(sourceTime(19.3)).toBeNull();
    expect(sourceTime('24:00')).toBeNull(); expect(sourceTime('10:99')).toBeNull();
  });
  it('keeps a verified class date without inventing an hour when the original schedule clock is unsupported', () => {
    const run = verifiable({ items: [report(), session({ Jam: 19.3 })] });
    const output = verifySourceRun(run, reviewed);
    expect(output.verified).toBe(true); expect(output.unresolved).toEqual([]);
    expect(output.meetings[0]).toMatchObject({ date: '2026-11-02', dateOnly: '2026-11-02', time: null, time_precision: 'DATE', label: 'Synthetic robotics' });
    expect(output.meetings[0].provenance.time_precision).toBe('DATE');
  });
  it('requires agreement with reviewed code, retained Code5 output and the successful writer', () => {
    expect(verifySourceRun(verifiable(), reviewed).verified).toBe(true);
    const changed = report(); changed['Absen Online 1'] = 2;
    expect(verifySourceRun(verifiable({ storedOutput: [changed] }), reviewed).failures).toContain('replay_differs_from_stored_code_output');
    expect(verifySourceRun(verifiable({ writerOutput: [changed] }), reviewed).failures).toContain('writer_output_differs');
    expect(verifySourceRun(verifiable({ writerSucceeded: false }), reviewed).meetings).toEqual([]);
  });
  it('rejects changed code and mismatched historical weekday filters', () => {
    expect(verifySourceRun(verifiable({ code: reviewed + '\n' }), reviewed).failures).toEqual(['unreviewed_code_hash']);
    expect(verifySourceRun(verifiable({ sourceWeekday: 'Selasa' }), reviewed).failures).toContain('runtime_weekday_differs_from_stored_filter');
    expect(verifySourceRun(verifiable({ sourceWeekday: undefined }), reviewed).failures).toContain('missing_stored_weekday_filter');
  });
  it('requires finite integer source counters and refuses duplicate coach identities', () => {
    const bad = report(); delete bad['Absen Offline'];
    expect(verifySourceRun(verifiable({ items: [bad, session()] }), reviewed).failures).toContain('invalid_counter_value');
    expect(verifySourceRun(verifiable({ items: [report(), report(), session()] }), reviewed).failures).toContain('duplicate_coach_report_ids');
  });
  it('deduplicates repeated extraction of one execution but flags distinct committed attempts', () => {
    const first = verifySourceRun(verifiable(), reviewed), second = verifySourceRun(verifiable({ executionId: 'retry-run' }), reviewed);
    const result = summarizeSourceRuns([first, first, second], { startsOn: '2026-11-02', throughDate: '2026-11-03' });
    expect(result.meetings).toHaveLength(2); expect(result.summary.duplicateInputRuns).toHaveLength(1);
    expect(result.summary.repeatedPhysicalRows).toHaveLength(1); expect(result.summary.missingCalendarDates).toEqual(['2026-11-03']);
  });
  it('retains zero-session successful days and never fills a missing day or a future date', () => {
    const output = summarizeSourceRuns([{ executionId: 'empty', verified: true, dateOnly: '2026-11-02', meetings: [], unresolved: [] }], { startsOn: '2026-11-02', throughDate: '2026-11-03' });
    expect(output.meetings).toEqual([]); expect(output.summary.missingCalendarDates).toEqual(['2026-11-03']);
  });
});
