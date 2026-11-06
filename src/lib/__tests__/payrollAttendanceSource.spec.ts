import { createHash } from 'node:crypto';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPeriod, type PayrollMeeting, type PeriodDocument } from '@/lib/payroll/model';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('node:util', () => ({ promisify: () => mocks.execute }));

const CODE_HASH = '596aa09c722a8c4c088d283662e4f25b89fa4eef7332cf88ede997654432cea8';
const now = new Date('2026-11-06T10:00:00+07:00');
const at = '2026-11-06T02:00:00.000Z';
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function sourceMeeting(index = 0, sourceCoachId = '123') {
  return { key: `source-execution:111:0:scheduled:${index}`, sourceCoachId, date: '2026-11-06T08:00:00.000Z', dateOnly: '2026-11-06', time: '15:00:00', time_precision: 'TIME', label: `Synthetic Robotics ${index}`, kind: 'WEEKLY', delivery: 'ONLINE', studentsBucket: 1, studentsAreBucket: true, mode: 'MITRA', bucket: 'Absen Online 1', substitute: false, sourceRow: 12 + index, provenance: { executionId: '111', nodeRun: 0, codeAt: at, inputIndex: index, originalScheduleInputIndex: index, leaveRow: null, sourceDocumentId: 'synthetic-private-document', sourceSheet: 'Jadwal Coaches', leaveSheet: null, time_precision: 'TIME' } };
}
function report(meetings = [sourceMeeting()]) {
  const increments: { sourceCoachId: string; buckets: Record<string, number> }[] = [];
  for (const meeting of meetings) {
    let increment = increments.find(row => row.sourceCoachId === meeting.sourceCoachId);
    if (!increment) { increment = { sourceCoachId: meeting.sourceCoachId, buckets: {} }; increments.push(increment); }
    increment.buckets[meeting.bucket] = (increment.buckets[meeting.bucket] ?? 0) + 1;
  }
  const run = { executionId: '111', nodeRun: 0, at, dateOnly: '2026-11-06', codeHash: CODE_HASH, verified: true, failures: [] as string[], increments, unresolved: [] as unknown[], meetings };
  const fingerprintInputs = [['111', 0, Date.parse(at), CODE_HASH, 'a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)]];
  return { schema: 1, period: '2026-11', capturedAt: now.toISOString(), reviewedCodeHash: CODE_HASH, runtimeTimezone: 'UTC', snapshotFingerprint: digest(fingerprintInputs), fingerprintInputs, runs: [run], meetings, summary: { totalRuns: 1, verifiedRuns: 1, unverifiedRuns: 0, meetingCount: meetings.length, unresolvedMeetingCount: 0, duplicateInputRuns: [] as string[], repeatedPhysicalRows: [] as string[][], missingCalendarDates: ['2026-10-28'], ignoredExecutionsWithoutCodeNode: 0 } };
}
function meeting(patch: Partial<PayrollMeeting> = {}): PayrollMeeting {
  return { key: 'native:1', user_id: 'native-user', date: '2026-11-02T08:00:00Z', label: 'Native LMS Class', kind: 'WEEKLY', delivery: 'ONLINE', students: 1, cancelled: false, ...patch };
}
function period(): PeriodDocument {
  const p = createPeriod(2026, 11);
  p.legacy_imports = [{ schema: 1, sourceId: 'synthetic-file', sourceName: 'Synthetic source', url: 'https://example.invalid', period: p.id, sourceCreatedAt: at, sourceModifiedAt: at, capturedAt: at, checksum: 'a'.repeat(64), rows: [], total: 0, totalBasis: 'SOURCE_TOTAL' }];
  p.legacy_links = { '123': { status: 'LINKED', kind: 'COACH', profile_id: 'profile-1', user_id: 'user-1', name: 'Synthetic Coach', reason: 'Confirmed synthetic mapping', confirmed_at: at } };
  p.meeting_catalog = [meeting(), meeting({ key: 'manual:1', label: 'Manual LMS Event', kind: 'EVENT' }), meeting({ key: 'old-source:1', user_id: 'old-user', origin: 'SOURCE', source_identity: 'old-id' })];
  return p;
}
async function refresh(p: PeriodDocument, time = now) { return (await import('@/lib/services/payrollAttendanceSource')).refreshAttendanceSource(p, time); }
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.stubEnv('PAYROLL_LOCAL_PREVIEW', 'false');
  mocks.execute.mockResolvedValue({ stdout: JSON.stringify(report()), stderr: '' });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined); vi.spyOn(console, 'info').mockImplementation(() => undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('read-only verified attendance source catalog', () => {
  it('maps exact confirmed coach identities, preserves native/manual meetings, and retains future planned dates', async () => {
    const p = period(), before = structuredClone(p), next = await refresh(p);
    expect(p).toEqual(before); expect(next).not.toBe(p);
    expect(next.meeting_catalog!.filter(m => m.origin !== 'SOURCE')).toEqual(p.meeting_catalog!.filter(m => m.origin !== 'SOURCE'));
    const source = next.meeting_catalog!.filter(m => m.origin === 'SOURCE');
    expect(source).toHaveLength(1); expect(source[0]).toMatchObject({ user_id: 'user-1', source_identity: '123', source_counter: 'Absen Online 1', date: '2026-11-06T08:00:00.000Z', label: 'Synthetic Robotics 0', kind: 'WEEKLY', delivery: 'ONLINE', students: 1, mode: 'MITRA', fee_eligible: true, cancelled: false, provenance: { execution_id: '111', source_row: 12, workflow_hash: CODE_HASH } });
    expect(source[0].key).toMatch(/^source-meeting:[a-f0-9]{64}$/); expect(Date.parse(source[0].date)).toBeGreaterThan(now.getTime());
    expect(next.source_meetings_checked_at).toBe(now.toISOString()); expect(next.source_meetings_fingerprint).toBe(report().snapshotFingerprint);
    expect(mocks.execute).toHaveBeenCalledWith('python3', [path.join(process.cwd(), 'scripts/payroll-attendance-source.py'), '--config', '/root/lms/shared/payroll-source-sync.json', '--period', p.id, '--json'], { timeout: 45000, maxBuffer: 2 * 1024 * 1024 });
  });
  it('skips ignored/staff/unmapped recipients without guessing names or leaking IDs/names into logs', async () => {
    const p = period();
    p.legacy_links!['456'] = { status: 'IGNORED', reason: 'Ignore source recipient', confirmed_at: at };
    p.legacy_links!['789'] = { status: 'LINKED', kind: 'STAFF', profile_id: 'staff', user_id: null, name: 'Private staff name', reason: 'Staff mapping', confirmed_at: at };
    mocks.execute.mockResolvedValue({ stdout: JSON.stringify(report([sourceMeeting(), sourceMeeting(1, '456'), sourceMeeting(2, '789'), sourceMeeting(3, 'private-unmapped-id')])), stderr: '' });
    const next = await refresh(p);
    expect(next.meeting_catalog!.filter(m => m.origin === 'SOURCE')).toHaveLength(1);
    const logs = JSON.stringify(vi.mocked(console.info).mock.calls);
    expect(logs).toContain('count'); expect(logs).not.toMatch(/private-unmapped-id|Private staff name|Synthetic Robotics|123|456|789/);
  });
  it('preserves date-only proof without assigning a fictional time', async () => {
    const source = sourceMeeting(); source.date = source.dateOnly; source.time = null as unknown as string; source.time_precision = 'DATE'; source.provenance.time_precision = 'DATE';
    mocks.execute.mockResolvedValue({ stdout: JSON.stringify(report([source])), stderr: '' });
    expect((await refresh(period())).meeting_catalog!.find(m => m.origin === 'SOURCE')?.date).toBe('2026-11-06');
  });
  it('allows missing calendar dates and unresolved rows without inventing meetings for gaps', async () => {
    const result = report(); result.runs[0].unresolved = [{ reasons: ['missing_class_label'] }]; result.summary.unresolvedMeetingCount = 1; result.runs[0].increments[0].buckets['Absen Online 1'] = 2;
    mocks.execute.mockResolvedValue({ stdout: JSON.stringify(result), stderr: '' });
    const next = await refresh(period()); expect(next.meeting_catalog!.filter(m => m.origin === 'SOURCE')).toHaveLength(1); expect(next.meeting_catalog!.some(m => m.date.startsWith('2026-10-28'))).toBe(false);
  });
  it.each(['local', 'archive', 'no-import', 'final'])('skips %s without calling Python and returns an independent clone', async reason => {
    const p = period(); if (reason === 'local') vi.stubEnv('PAYROLL_LOCAL_PREVIEW', 'true'); if (reason === 'archive') { p.id = '2026-10'; p.month = 10; } if (reason === 'no-import') p.legacy_imports = []; if (reason === 'final') p.status = 'FINAL';
    const next = await refresh(p); expect(next).toEqual(p); expect(next).not.toBe(p); expect(mocks.execute).not.toHaveBeenCalled();
  });
  it.each(['fingerprint', 'reviewed-hash', 'run-hash', 'unverified', 'period', 'counter', 'top-level', 'out-of-period'])('retains all previous proof after a %s integrity failure', async reason => {
    const result = report();
    if (reason === 'fingerprint') result.snapshotFingerprint = 'f'.repeat(64);
    if (reason === 'reviewed-hash') result.reviewedCodeHash = 'f'.repeat(64);
    if (reason === 'run-hash') result.runs[0].codeHash = 'f'.repeat(64);
    if (reason === 'unverified') result.runs[0].verified = false;
    if (reason === 'period') result.period = '2026-10';
    if (reason === 'counter') result.runs[0].increments[0].buckets['Absen Online 1'] = 2;
    if (reason === 'top-level') result.meetings = [{ ...result.meetings[0], label: 'Forged label' }];
    if (reason === 'out-of-period') {
      const m = result.meetings[0]; m.dateOnly = '2026-10-25'; m.date = '2026-10-25T08:00:00.000Z'; m.provenance.codeAt = '2026-10-25T02:00:00.000Z'; result.runs[0].dateOnly = m.dateOnly; result.runs[0].at = m.provenance.codeAt; result.fingerprintInputs[0][2] = Date.parse(m.provenance.codeAt); result.snapshotFingerprint = digest(result.fingerprintInputs);
    }
    mocks.execute.mockResolvedValue({ stdout: JSON.stringify(result), stderr: '' });
    const p = period(); expect(await refresh(p)).toEqual(p); expect(console.warn).toHaveBeenCalledExactlyOnceWith('[Payroll attendance source] Refresh unavailable; previous verified meetings retained.');
  });
  it('rejects conflicting duplicate execution evidence while accepting identical duplicate fingerprints', async () => {
    const result = report(); result.fingerprintInputs.push([...result.fingerprintInputs[0]]); result.summary.duplicateInputRuns = ['111:0']; result.snapshotFingerprint = digest(result.fingerprintInputs);
    mocks.execute.mockResolvedValue({ stdout: JSON.stringify(result), stderr: '' });
    expect((await refresh(period())).source_meetings_fingerprint).toBe(result.snapshotFingerprint);
    await vi.resetModules(); result.fingerprintInputs[1][4] = 'f'.repeat(64); result.snapshotFingerprint = digest(result.fingerprintInputs); mocks.execute.mockResolvedValue({ stdout: JSON.stringify(result), stderr: '' });
    const p = period(); expect(await refresh(p)).toEqual(p);
  });
  it('excludes every ambiguous repeated physical copy while retaining unrelated verified meetings', async () => {
    const first = sourceMeeting(), second = { ...first, key: 'source-execution:111:0:scheduled:1', provenance: { ...first.provenance, inputIndex: 1 } }, unrelated = sourceMeeting(2);
    const result = report([first, second, unrelated]); result.summary.repeatedPhysicalRows = [[first.key, second.key]];
    mocks.execute.mockResolvedValue({ stdout: JSON.stringify(result), stderr: '' });
    const source = (await refresh(period())).meeting_catalog!.filter(m => m.origin === 'SOURCE');
    expect(source).toHaveLength(1); expect(source[0].label).toBe('Synthetic Robotics 2');
  });
  it('excludes all duplicate physical classes from legacy aliases mapped to the same LMS user', async () => {
    const p = period(); p.legacy_links!['456'] = { ...p.legacy_links!['123'] };
    const original = { ...sourceMeeting(), label: '  Synthetic   ROBOTICS  ' };
    const alias = { ...sourceMeeting(1, '456'), label: 'synthetic robotics', kind: 'EKSKUL' };
    const unrelated = { ...sourceMeeting(2), label: 'Other Synthetic Class' };
    mocks.execute.mockResolvedValue({ stdout: JSON.stringify(report([original, alias, unrelated])), stderr: '' });
    const next = await refresh(p), source = next.meeting_catalog!.filter(m => m.origin === 'SOURCE');
    expect(source).toHaveLength(1); expect(source[0]).toMatchObject({ user_id: 'user-1', source_identity: '123', label: 'Other Synthetic Class' });
    expect(next.meeting_catalog!.filter(m => m.origin !== 'SOURCE')).toEqual(p.meeting_catalog!.filter(m => m.origin !== 'SOURCE'));
  });
  it('caches only successful reads for at most one hour and does not extend the proof timestamp on cache reuse', async () => {
    const p = period(), first = await refresh(p);
    expect(await refresh(first, new Date(now.getTime() + 30 * 60000))).toEqual(first);
    const second = await refresh(p, new Date(now.getTime() + 30 * 60000));
    expect(second.source_meetings_checked_at).toBe(now.toISOString()); expect(mocks.execute).toHaveBeenCalledTimes(1);
    const refreshedAt = new Date(now.getTime() + 3600000), result = report(); result.capturedAt = refreshedAt.toISOString(); mocks.execute.mockResolvedValue({ stdout: JSON.stringify(result), stderr: '' });
    expect((await refresh(first, refreshedAt)).source_meetings_checked_at).toBe(refreshedAt.toISOString()); expect(mocks.execute).toHaveBeenCalledTimes(2);
  });
  it('preserves earlier proof and logs no source errors or PII after timeout/failed reads, then retries', async () => {
    const p = period(); p.source_meetings_checked_at = new Date(now.getTime() - 3600000).toISOString(); p.source_meetings_fingerprint = 'a'.repeat(64);
    mocks.execute.mockRejectedValueOnce(new Error('private token=secret coach123 Class Confidential'));
    expect(await refresh(p)).toEqual(p);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toMatch(/secret|coach123|Confidential/);
    expect((await refresh(p)).source_meetings_checked_at).toBe(now.toISOString()); expect(mocks.execute).toHaveBeenCalledTimes(2);
  });
});
