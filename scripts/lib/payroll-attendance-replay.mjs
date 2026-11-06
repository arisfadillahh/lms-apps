import { createHash } from 'node:crypto';
import vm from 'node:vm';

export const COUNTERS = ['Absen Online', 'Absen Offline', 'Absen Online 1', 'Absen Online 2', 'Absen Offline 1', 'Absen Offline 2', 'Transport-Motor'];
export const EVIDENCE_FIELDS = ['row_number', 'Hari', 'Jam', 'Tipe', 'NamaKelas', 'CoachID', 'Online/Offline', 'Status', 'Tranportasi', 'Jenis Kelas', 'Tanggal', 'PenggantiID', 'Coach ID', 'Username', ...COUNTERS];
const digest = value => createHash('sha256').update(value).digest('hex');
const typedId = id => `${typeof id}:${id}`;

export function sourceBucket(delivery, size) {
  if (!['Online', 'Offline'].includes(delivery)) return null;
  return `Absen ${delivery}${size === 1 ? ' 1' : size === 2 ? ' 2' : ''}`;
}
export function sourceTime(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || value >= 1) return null;
    const seconds = Math.round(value * 86400);
    if (seconds >= 86400) return null;
    return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  const match = /^(\d{1,2})[:.](\d{2})(?::(\d{2}))?$/.exec(String(value ?? '').trim());
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] ?? 0) > 59) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}:${match[3] ?? '00'}`;
}
function sourceKind(value) { return /^weekly$/i.test(String(value)) ? 'WEEKLY' : /^ekskul$/i.test(String(value)) ? 'EKSKUL' : null; }
function counterShape(rows) {
  return rows.map(row => ({ id: typedId(row['Coach ID']), counters: Object.fromEntries(COUNTERS.map(key => [key, row[key]])) })).sort((a, b) => a.id.localeCompare(b.id));
}
function finiteCounters(rows) { return rows.every(row => COUNTERS.every(key => Number.isSafeInteger(row[key]) && row[key] >= 0)); }
function sameCounters(a, b) { return JSON.stringify(counterShape(a)) === JSON.stringify(counterShape(b)); }

/** Port of the inspected source allocation. Strict ID/size equality is intentional. */
export function allocateSourceMeetings({ items, at, timezone = 'UTC', specialCoachIds = [], executionId, nodeRun = 0 }) {
  const data = structuredClone(items), instant = new Date(at);
  if (!Number.isFinite(instant.getTime())) throw new Error('Invalid execution clock.');
  const dateOnly = instant.toISOString().slice(0, 10), weekday = instant.toLocaleDateString('id-ID', { weekday: 'long', timeZone: timezone });
  const leave = data.filter(row => row.Status === 'Izin' && row.Tanggal === dateOnly);
  const reports = data.filter(row => row['Coach ID']);
  const before = structuredClone(reports), meetings = [], unresolved = [], skipped = {};
  const skip = key => { skipped[key] = (skipped[key] ?? 0) + 1; };
  const scheduleMatch = (schedule, absence) => schedule.CoachID === absence.CoachID && schedule.Jam === absence.Jam && schedule.Hari === absence.Hari && schedule.Status === 'Masuk';
  function addMeeting(row, owner, delivery, size, source, substitute = false, originalMatches = 1) {
    const bucket = sourceBucket(delivery, size), time = sourceTime(row?.Jam), kind = sourceKind(row?.Tipe);
    const inputIndex = data.indexOf(source), originIndex = data.indexOf(row), reasons = [];
    if (!row?.NamaKelas) reasons.push('missing_class_label');
    if (!kind) reasons.push('unknown_class_kind');
    if (originalMatches !== 1) reasons.push('ambiguous_original_schedule');
    const record = {
      key: `source-execution:${executionId}:${nodeRun}:${substitute ? 'substitute' : 'scheduled'}:${inputIndex}`,
      sourceCoachId: String(owner), date: time ? new Date(`${dateOnly}T${time}+07:00`).toISOString() : dateOnly,
      dateOnly, time, label: row?.NamaKelas ?? null, kind, delivery: delivery === 'Online' ? 'ONLINE' : 'OFFLINE',
      time_precision: time ? 'TIME' : 'DATE',
      studentsBucket: size === 1 ? 1 : size === 2 ? 2 : 3, studentsAreBucket: true, mode: 'MITRA', bucket, substitute,
      sourceRow: row?.row_number ?? null,
      provenance: { executionId: String(executionId), nodeRun, codeAt: instant.toISOString(), inputIndex, originalScheduleInputIndex: originIndex >= 0 ? originIndex : null, leaveRow: substitute ? source.row_number ?? null : null, time_precision: time ? 'TIME' : 'DATE' },
    };
    if (reasons.length) unresolved.push({ ...record, reasons }); else meetings.push(record);
  }
  const scheduled = data.filter(row => row.Hari === weekday && row.Status === 'Masuk' && !leave.some(absence => scheduleMatch(row, absence)));
  for (const row of scheduled) {
    const target = reports.find(report => report['Coach ID'] === row.CoachID);
    if (!target) { skip('missing_coach_report'); continue; }
    const covered = specialCoachIds.includes(row.CoachID) && !row.NamaKelas?.toLowerCase().includes('(mitra)');
    const bucket = sourceBucket(row['Online/Offline'], row['Jenis Kelas']);
    if (!covered && bucket) { target[bucket]++; addMeeting(row, row.CoachID, row['Online/Offline'], row['Jenis Kelas'], row); }
    else skip(covered ? 'salary_covered' : 'unknown_delivery');
    if (row.Tranportasi === 'Motor') target['Transport-Motor']++;
  }
  for (const absence of leave) {
    if (!absence.PenggantiID) { skip('leave_without_substitute'); continue; }
    const target = reports.find(report => report['Coach ID'] === absence.PenggantiID);
    if (!target) { skip('missing_substitute_report'); continue; }
    const originals = data.filter(row => scheduleMatch(row, absence));
    let delivery = absence['Online/Offline'], size = absence['Jenis Kelas'];
    if ((!delivery || !size) && originals[0]) { delivery = originals[0]['Online/Offline']; size = originals[0]['Jenis Kelas']; }
    const bucket = sourceBucket(delivery, size);
    if (bucket) { target[bucket]++; addMeeting(originals[0], absence.PenggantiID, delivery, size, absence, true, originals.length); }
    else skip('unknown_substitute_delivery');
  }
  return { before, after: reports, meetings, unresolved, skipped, dateOnly, weekday };
}

/** Execute only the exact code hash already inspected by the caller, with a fixed clock. */
function replayReviewedCode(code, items, at, timezone) {
  const stamp = new Date(at).getTime();
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [stamp])); }
    static now() { return stamp; }
    toLocaleDateString(locale, options) { return super.toLocaleDateString(locale, { ...options, timeZone: timezone }); }
  }
  const result = new vm.Script(`(function(){${code}\n})()`).runInNewContext({ items: structuredClone(items).map(json => ({ json })), Date: FixedDate }, { timeout: 1000 });
  return result.map(item => item.json);
}

export function verifySourceRun(run, reviewedCode) {
  const failures = [], expectedHash = digest(reviewedCode), codeHash = digest(run.code ?? '');
  const fail = key => failures.push(key);
  if (codeHash !== expectedHash) return { executionId: run.executionId, verified: false, failures: ['unreviewed_code_hash'], codeHash, meetings: [] };
  const special = /const\s+specialCoaches\s*=\s*(\[[^\]]*\])/.exec(reviewedCode);
  if (!special) return { executionId: run.executionId, verified: false, failures: ['special_coach_rules_not_found'], codeHash, meetings: [] };
  const specialCoachIds = JSON.parse(special[1]);
  if (!run.writerSucceeded) fail('counter_writer_not_successful');
  if (run.taskCount !== 1) fail('multiple_code_tasks_require_review');
  const result = allocateSourceMeetings({ ...run, specialCoachIds });
  const ids = result.before.map(row => String(row['Coach ID']));
  if (new Set(ids).size !== ids.length) fail('duplicate_coach_report_ids');
  if (!finiteCounters(result.before) || !finiteCounters(result.after) || !finiteCounters(run.storedOutput)) fail('invalid_counter_value');
  const actual = replayReviewedCode(run.code, run.items, run.at, run.timezone ?? 'UTC');
  if (!sameCounters(result.after, actual)) fail('ported_allocation_differs_from_reviewed_code');
  if (!sameCounters(actual, run.storedOutput)) fail('replay_differs_from_stored_code_output');
  const expectedByUsername = new Map(actual.map(row => [row.Username, row]));
  if (expectedByUsername.size !== actual.length || run.writerOutput.length !== actual.length || run.writerOutput.some(row => !expectedByUsername.has(row.Username) || COUNTERS.some(key => row[key] !== expectedByUsername.get(row.Username)[key]))) fail('writer_output_differs');
  if (!run.sourceWeekday) fail('missing_stored_weekday_filter');
  else if (run.sourceWeekday !== result.weekday) fail('runtime_weekday_differs_from_stored_filter');
  const increments = result.after.map((row, index) => ({ sourceCoachId: String(row['Coach ID']), buckets: Object.fromEntries(COUNTERS.map(key => [key, row[key] - result.before[index][key]]).filter(([, count]) => count !== 0)) })).filter(row => Object.keys(row.buckets).length);
  const classDelta = increments.reduce((sum, row) => sum + Object.entries(row.buckets).filter(([key]) => key !== 'Transport-Motor').reduce((subtotal, [, count]) => subtotal + count, 0), 0);
  if (classDelta !== result.meetings.length + result.unresolved.length) fail('counter_delta_unattributed');
  const allocations = new Map();
  for (const meeting of [...result.meetings, ...result.unresolved]) { const key = JSON.stringify([meeting.sourceCoachId, meeting.bucket]); allocations.set(key, (allocations.get(key) ?? 0) + 1); }
  for (const increment of increments) for (const [bucket, count] of Object.entries(increment.buckets)) if (bucket !== 'Transport-Motor' && allocations.get(JSON.stringify([increment.sourceCoachId, bucket])) !== count) fail('coach_bucket_delta_unattributed');
  return { executionId: String(run.executionId), startedAt: run.startedAt, at: run.at, dateOnly: result.dateOnly, codeHash, verified: failures.length === 0, failures, increments, skipped: result.skipped, unresolved: result.unresolved, meetings: failures.length ? [] : result.meetings };
}

/** Preserve distinct committed executions; flag repeated physical rows rather than silently dropping money. */
export function summarizeSourceRuns(runs, { startsOn, throughDate }) {
  const unique = new Map(), duplicateInputRuns = [];
  for (const run of runs) { const key = `${run.executionId}:${run.nodeRun ?? 0}`; if (unique.has(key)) duplicateInputRuns.push(key); else unique.set(key, run); }
  const records = [...unique.values()], meetings = records.filter(run => run.verified).flatMap(run => run.meetings), physical = new Map();
  for (const meeting of meetings) { const key = JSON.stringify([meeting.dateOnly, meeting.sourceRow, meeting.sourceCoachId, meeting.label, meeting.time]); const group = physical.get(key) ?? []; group.push(meeting.key); physical.set(key, group); }
  const repeatedPhysicalRows = [...physical.values()].filter(keys => keys.length > 1);
  const covered = new Set(records.filter(run => run.verified).map(run => run.dateOnly)), missingCalendarDates = [];
  for (let date = new Date(startsOn + 'T00:00:00Z'); date.toISOString().slice(0, 10) <= throughDate; date.setUTCDate(date.getUTCDate() + 1)) { const day = date.toISOString().slice(0, 10); if (!covered.has(day)) missingCalendarDates.push(day); }
  return { runs: records, meetings, summary: { totalRuns: records.length, verifiedRuns: records.filter(run => run.verified).length, unverifiedRuns: records.filter(run => !run.verified).length, meetingCount: meetings.length, unresolvedMeetingCount: records.reduce((sum, run) => sum + (run.unresolved?.length ?? 0), 0), duplicateInputRuns, repeatedPhysicalRows, missingCalendarDates } };
}
