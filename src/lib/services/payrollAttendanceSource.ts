import 'server-only';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import path from 'node:path';
import { z } from 'zod';
import { currentPeriod, wibDate, type PayrollMeeting, type PeriodDocument } from '@/lib/payroll/model';

const execute = promisify(execFile);
const REVIEWED_CODE_HASH = '596aa09c722a8c4c088d283662e4f25b89fa4eef7332cf88ede997654432cea8';
const HOUR = 3600000;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const day = z.string().regex(/^20\d{2}-\d{2}-\d{2}$/);
const instant = z.string().datetime({ offset: true });
const nonnegative = z.number().int().nonnegative();
const provenance = z.object({ executionId: z.string().min(1).max(100), nodeRun: nonnegative, codeAt: instant, inputIndex: nonnegative, originalScheduleInputIndex: nonnegative.nullable(), leaveRow: z.number().int().positive().nullable(), sourceDocumentId: z.string().min(1).max(200), sourceSheet: z.literal('Jadwal Coaches'), leaveSheet: z.literal('Izin').nullable(), time_precision: z.enum(['DATE', 'TIME']) });
const meetingSchema = z.object({ key: z.string().min(1).max(300), sourceCoachId: z.string().min(1).max(160), date: z.union([instant, day]), dateOnly: day, time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/).nullable(), time_precision: z.enum(['DATE', 'TIME']), label: z.string().trim().min(1).max(500), kind: z.enum(['WEEKLY', 'EKSKUL']), delivery: z.enum(['ONLINE', 'OFFLINE']), studentsBucket: z.number().int().min(1).max(3), studentsAreBucket: z.literal(true), mode: z.literal('MITRA'), bucket: z.enum(['Absen Online', 'Absen Offline', 'Absen Online 1', 'Absen Online 2', 'Absen Offline 1', 'Absen Offline 2']), substitute: z.boolean(), sourceRow: z.number().int().positive(), provenance });
const runSchema = z.object({ executionId: z.string().min(1).max(100), nodeRun: nonnegative, at: instant, dateOnly: day, codeHash: hash, verified: z.literal(true), failures: z.array(z.unknown()).length(0), increments: z.array(z.object({ sourceCoachId: z.string(), buckets: z.record(z.string(), nonnegative) })), unresolved: z.array(z.unknown()), meetings: z.array(meetingSchema) });
const fingerprintInput = z.tuple([z.string(), nonnegative, z.number().int().nonnegative(), hash, hash, hash, hash]);
const reportSchema = z.object({ schema: z.literal(1), period: z.string(), capturedAt: instant, reviewedCodeHash: hash, runtimeTimezone: z.string().min(1).max(100), snapshotFingerprint: hash, fingerprintInputs: z.array(fingerprintInput), runs: z.array(runSchema), meetings: z.array(meetingSchema), summary: z.object({ totalRuns: nonnegative, verifiedRuns: nonnegative, unverifiedRuns: z.literal(0), meetingCount: nonnegative, unresolvedMeetingCount: nonnegative, duplicateInputRuns: z.array(z.string()), repeatedPhysicalRows: z.array(z.array(z.string()).min(2)), missingCalendarDates: z.array(day), ignoredExecutionsWithoutCodeNode: nonnegative }) });
type SourceReport = z.infer<typeof reportSchema>;
type SourceMeeting = z.infer<typeof meetingSchema>;
const cache = new Map<string, { at: number; report: SourceReport }>();
const pending = new Map<string, Promise<string>>();

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function requireProof(condition: unknown) { if (!condition) throw new Error('Invalid source proof'); }
function validateReport(input: unknown, period: PeriodDocument, now: Date): SourceReport {
  const report = reportSchema.parse(input);
  requireProof(report.period === period.id && report.reviewedCodeHash === REVIEWED_CODE_HASH);
  requireProof(sha256(JSON.stringify(report.fingerprintInputs)) === report.snapshotFingerprint);
  const captured = Date.parse(report.capturedAt);
  requireProof(captured <= now.getTime() + 120000 && now.getTime() - captured < HOUR);
  requireProof(report.summary.totalRuns === report.runs.length && report.summary.verifiedRuns === report.runs.length && report.summary.meetingCount === report.meetings.length);
  requireProof(report.summary.unresolvedMeetingCount === report.runs.reduce((sum, run) => sum + run.unresolved.length, 0));
  const fingerprints = new Map<string, z.infer<typeof fingerprintInput>>();
  for (const fingerprint of report.fingerprintInputs) {
    requireProof(fingerprint[3] === REVIEWED_CODE_HASH);
    const key = `${fingerprint[0]}:${fingerprint[1]}`;
    const previous = fingerprints.get(key);
    requireProof(!previous || canonical(previous) === canonical(fingerprint));
    fingerprints.set(key, fingerprint);
  }
  const runKeys = new Set<string>();
  const flattened = new Map<string, SourceMeeting>();
  for (const run of report.runs) {
    const key = `${run.executionId}:${run.nodeRun}`, fingerprint = fingerprints.get(key);
    requireProof(!runKeys.has(key) && fingerprint && fingerprint[2] === Date.parse(run.at) && run.codeHash === REVIEWED_CODE_HASH);
    runKeys.add(key);
    requireProof(run.dateOnly === new Date(run.at).toISOString().slice(0, 10));
    let counterTotal = 0;
    for (const increment of run.increments) {
      for (const [counter, count] of Object.entries(increment.buckets)) {
        if (counter.startsWith('Absen ')) {
          requireProof(['Absen Online', 'Absen Offline', 'Absen Online 1', 'Absen Online 2', 'Absen Offline 1', 'Absen Offline 2'].includes(counter));
          counterTotal += count;
        } else requireProof(counter === 'Transport-Motor');
      }
    }
    requireProof(counterTotal === run.meetings.length + run.unresolved.length);
    for (const meeting of run.meetings) {
      requireProof(!flattened.has(meeting.key));
      requireProof(meeting.provenance.executionId === run.executionId && meeting.provenance.nodeRun === run.nodeRun && meeting.provenance.codeAt === run.at && meeting.dateOnly === run.dateOnly);
      requireProof(meeting.key === `source-execution:${run.executionId}:${run.nodeRun}:${meeting.substitute ? 'substitute' : 'scheduled'}:${meeting.provenance.inputIndex}`);
      const expectedCounter = `Absen ${meeting.delivery === 'ONLINE' ? 'Online' : 'Offline'}${meeting.studentsBucket < 3 ? ` ${meeting.studentsBucket}` : ''}`;
      requireProof(meeting.bucket === expectedCounter);
      requireProof(meeting.time_precision === meeting.provenance.time_precision);
      if (meeting.time_precision === 'DATE') requireProof(meeting.time === null && meeting.date === meeting.dateOnly && wibDate(`${meeting.date}T00:00:00+07:00`) === meeting.dateOnly);
      else requireProof(meeting.time !== null && new Date(`${meeting.dateOnly}T${meeting.time}+07:00`).toISOString() === new Date(meeting.date).toISOString() && wibDate(meeting.date) === meeting.dateOnly);
      const stamp = Date.parse(meeting.date.length === 10 ? `${meeting.date}T00:00:00+07:00` : meeting.date);
      requireProof(stamp >= Date.parse(period.starts_at) && stamp < Date.parse(period.ends_at));
      flattened.set(meeting.key, meeting);
    }
    // Every dated record must be accounted for under its exact source payee/bucket.
    for (const meeting of run.meetings) {
      const allocated = run.increments.filter(row => row.sourceCoachId === meeting.sourceCoachId).reduce((sum, row) => sum + (row.buckets[meeting.bucket] ?? 0), 0);
      const matched = run.meetings.filter(row => row.sourceCoachId === meeting.sourceCoachId && row.bucket === meeting.bucket).length;
      requireProof(allocated >= matched);
    }
  }
  requireProof(fingerprints.size === report.runs.length && flattened.size === report.meetings.length);
  const topKeys = new Set<string>();
  for (const meeting of report.meetings) {
    requireProof(!topKeys.has(meeting.key) && canonical(flattened.get(meeting.key)) === canonical(meeting));
    topKeys.add(meeting.key);
  }
  return report;
}

function sourceCatalog(report: SourceReport, period: PeriodDocument): PayrollMeeting[] {
  const physical = new Map<string, SourceMeeting[]>();
  for (const meeting of report.meetings) {
    const key = canonical([meeting.date, meeting.sourceRow, meeting.sourceCoachId, meeting.label.replace(/\s+/g, ' ').trim()]);
    const group = physical.get(key) ?? []; group.push(meeting); physical.set(key, group);
  }
  const ambiguous = new Set([...physical.values()].filter(group => group.length > 1).flatMap(group => group.map(meeting => meeting.key)));
  for (const group of report.summary.repeatedPhysicalRows) for (const key of group) { requireProof(report.meetings.some(meeting => meeting.key === key)); ambiguous.add(key); }
  const meetings: PayrollMeeting[] = []; let unmapped = 0;
  for (const meeting of report.meetings) {
    if (ambiguous.has(meeting.key)) continue;
    const link = period.legacy_links?.[meeting.sourceCoachId];
    if (!link || link.status !== 'LINKED' || link.kind !== 'COACH' || !link.user_id) { if (!link) unmapped++; continue; }
    const material = canonical({ provenance: meeting.provenance, date: meeting.date, source_row: meeting.sourceRow, payee: meeting.sourceCoachId });
    meetings.push({ key: `source-meeting:${sha256(material)}`, user_id: link.user_id, origin: 'SOURCE', source_identity: meeting.sourceCoachId, source_counter: meeting.bucket, kind: meeting.kind, date: meeting.date, label: meeting.label.replace(/\s+/g, ' ').trim(), delivery: meeting.delivery, students: meeting.studentsBucket, mode: 'MITRA', fee_eligible: true, cancelled: false, substitute: meeting.substitute || undefined, provenance: { execution_id: meeting.provenance.executionId, source_row: meeting.sourceRow, workflow_hash: report.reviewedCodeHash } });
  }
  if (unmapped) console.info('[Payroll attendance source] Unmapped recipient records skipped.', { count: unmapped });
  // Distinct legacy aliases may point at one LMS coach. Their identical class
  // records cannot prove two physical meetings, even when source rows differ.
  const mappedPhysical = new Map<string, PayrollMeeting[]>();
  for (const meeting of meetings) {
    const date = meeting.date.length === 10 ? meeting.date : new Date(meeting.date).toISOString();
    const key = canonical([meeting.user_id, date, meeting.label.replace(/\s+/g, ' ').trim().toLocaleLowerCase('id-ID'), 'CLASS']);
    const group = mappedPhysical.get(key) ?? []; group.push(meeting); mappedPhysical.set(key, group);
  }
  const aliasCollisions = new Set([...mappedPhysical.values()].filter(group => new Set(group.map(meeting => meeting.source_identity)).size > 1).flatMap(group => group.map(meeting => meeting.key)));
  return meetings.filter(meeting => !aliasCollisions.has(meeting.key)).sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

async function readSource(periodId: string) {
  let request = pending.get(periodId);
  if (!request) {
    request = execute('python3', [path.join(process.cwd(), 'scripts/payroll-attendance-source.py'), '--config', '/root/lms/shared/payroll-source-sync.json', '--period', periodId, '--json'], { timeout: 45000, maxBuffer: 2 * 1024 * 1024 }).then(result => result.stdout);
    pending.set(periodId, request);
  }
  try { return await request; } finally { if (pending.get(periodId) === request) pending.delete(periodId); }
}

/** Read verified source evidence only. Calculation/commit remains the caller's responsibility. */
export async function refreshAttendanceSource(period: PeriodDocument, now = new Date()): Promise<PeriodDocument> {
  const next = structuredClone(period);
  if (process.env.PAYROLL_LOCAL_PREVIEW === 'true' || period.status !== 'DRAFT' || period.id !== currentPeriod(now).id || !period.legacy_imports?.length) return next;
  const checked = Date.parse(period.source_meetings_checked_at ?? '');
  if (Number.isFinite(checked) && checked <= now.getTime() && now.getTime() - checked < HOUR && /^[a-f0-9]{64}$/.test(period.source_meetings_fingerprint ?? '')) return next;
  try {
    const previous = cache.get(period.id);
    const cached = previous && previous.at <= now.getTime() && now.getTime() - previous.at < HOUR ? previous : null;
    const report = cached?.report ?? validateReport(JSON.parse(await readSource(period.id)), period, now);
    const source = sourceCatalog(report, period);
    const retained = (period.meeting_catalog ?? []).filter(meeting => meeting.origin !== 'SOURCE');
    requireProof(!source.some(meeting => retained.some(existing => existing.key === meeting.key)));
    next.meeting_catalog = [...retained, ...source];
    next.source_meetings_checked_at = new Date(cached?.at ?? now.getTime()).toISOString();
    next.source_meetings_fingerprint = report.snapshotFingerprint;
    if (!cached) { for (const [key, value] of cache) if (now.getTime() - value.at >= HOUR) cache.delete(key); cache.set(period.id, { at: now.getTime(), report }); }
    return next;
  } catch {
    console.warn('[Payroll attendance source] Refresh unavailable; previous verified meetings retained.');
    return next;
  }
}
