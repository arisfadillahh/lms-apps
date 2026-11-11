import type { Activity, ActivityOverride, PayrollLine, PayrollMeeting, PayrollPerson, PeriodDocument } from './model';
import { projectStudentAttendance } from './studentAttendanceState.ts';

const kinds = new Set(['WEEKLY', 'EKSKUL', 'TRIAL', 'EVENT', 'TRAINING_ONLINE', 'TRAINING_OFFLINE', 'OBSERVATION_ONLINE', 'OBSERVATION_OFFLINE']);
export function canonicalMeetingCandidates(meetings: PayrollMeeting[]): PayrollMeeting[] {
  const physical=new Map<string,PayrollMeeting>();
  for(const m of meetings){
    const kind=['WEEKLY','EKSKUL'].includes(m.kind)?'CLASS':m.kind;
    const key=JSON.stringify([m.user_id,Date.parse(m.date),m.label.trim().replace(/\s+/g,' ').toLocaleLowerCase('id-ID'),kind]);
    const previous=physical.get(key);
    if(!previous || (previous.origin!=='SOURCE' && m.origin==='SOURCE'))physical.set(key,m);
  }
  return [...physical.values()];
}
export function meetingFromActivity(a: Activity): PayrollMeeting {
  return { key: a.key, date: a.date, label: a.label.split(' — ')[0], user_id: a.user_id, kind: a.kind, delivery: a.delivery, students: a.students, cancelled: a.cancelled, mode: a.mode, ...(a.session_mode ? { session_mode: a.session_mode } : {}), substitute: a.details?.includes('Coach pengganti') || undefined, ...projectStudentAttendance(a) };
}
export function meetingMatchesLine(m: PayrollMeeting, line: Pick<PayrollLine, 'kind' | 'label' | 'source_identity' | 'source_counter' | 'summary_before'>): boolean {
  if (line.summary_before && Date.parse(m.date) >= Date.parse(line.summary_before)) return false;
  if (m.origin === 'SOURCE' && ((line.source_identity && m.source_identity !== line.source_identity) || (line.source_counter && m.source_counter?.toLowerCase() !== line.source_counter.toLowerCase()))) return false;
  if (m.fee_eligible === false) return false;
  if (line.kind !== 'CLASS_SUMMARY') return m.kind === line.kind;
  if (!['WEEKLY', 'EKSKUL'].includes(m.kind)) return false;
  const offline = /offline/i.test(line.label);
  if (m.delivery !== (offline ? 'OFFLINE' : 'ONLINE')) return false;
  if (!m.students) return true; // Historical enrollment dimensions may be unavailable.
  const size = /1 anak/.test(line.label) ? 1 : /2 anak/.test(line.label) ? 2 : 3;
  return Math.min(m.students, 3) === size;
}

export function selectedMeetingKeys(override: Pick<ActivityOverride,'meeting_keys'|'selection_cutoff'> | undefined, candidates: PayrollMeeting[], line: Pick<PayrollLine,'kind'|'label'|'source_identity'|'source_counter'|'summary_before'>, userId?: string|null): string[] {
  if (!override?.meeting_keys) return [];
  const cutoff=Date.parse(override.selection_cutoff ?? '');
  return [...new Set([...override.meeting_keys,...candidates.filter(m=>m.origin==='SOURCE' && m.user_id===userId && !m.cancelled && Number.isFinite(cutoff) && Date.parse(m.date)>cutoff && meetingMatchesLine(m,line)).map(m=>m.key)])];
}

/** Exact real-meeting evidence only. Cumulative counts never invent dates. */
export function attachAttendanceDetails(p: PeriodDocument, activities: Activity[], people: PayrollPerson[], now = new Date()) {
  const catalog = new Map((p.meeting_catalog ?? []).map(m => [m.key, m]));
  for (const a of activities) if (kinds.has(a.kind)) catalog.set(a.key, meetingFromActivity(a));
  for (const slip of p.slips) {
    if (slip.kind !== 'COACH') continue;
    const details = new Map<string, PayrollMeeting>();
    const claimed = new Set<string>();
    let unresolved = 0;
    const own = [...catalog.values()].filter(m => {
      const override = p.overrides[m.key];
      const owner = override?.profile_id ? people.find(person => person.id === override.profile_id)?.user_id : m.user_id;
      const instant = Date.parse(m.date);
      return owner === slip.user_id && !override?.excluded && Number.isFinite(instant) && instant >= Date.parse(p.starts_at) && instant < Date.parse(p.ends_at) && (instant <= now.getTime() || m.origin === 'SOURCE');
    });
    // Salary-covered sessions are attendance too, although absent from paid summaries.
    if (p.legacy_imports?.length && slip.contract === 'FULLTIME') {
      const physical = (m: PayrollMeeting) => `${Date.parse(m.date)}:${m.label.trim().replace(/\s+/g,' ').toLocaleLowerCase('id-ID')}`;
      const proven = new Set(own.filter(m=>m.origin==='SOURCE').map(physical));
      for (const m of own) if (!proven.has(physical(m)) && (m.kind === 'TRIAL' || (['WEEKLY', 'EKSKUL'].includes(m.kind) && (p.overrides[m.key]?.mode ?? m.mode) === 'FULLTIME'))) details.set(m.key, m);
    }
    for (const line of slip.lines) {
      if (!kinds.has(line.kind) && line.kind !== 'CLASS_SUMMARY') continue;
      if (p.overrides[line.key]?.excluded || line.quantity <= 0) continue;
      if (line.summary) {
        const selected = p.overrides[line.key]?.meeting_keys;
        const matching = own.filter(m => !claimed.has(m.key) && !m.cancelled && meetingMatchesLine(m, line) && !(slip.contract === 'FULLTIME' && line.kind === 'CLASS_SUMMARY' && (p.overrides[m.key]?.mode ?? m.mode) === 'FULLTIME'));
        const proven = matching.filter(m => m.origin === 'SOURCE');
        const candidates = !selected && proven.length ? proven : matching;
        const cutoff = Date.parse(p.overrides[line.key]?.selection_cutoff ?? '');
        const matched = selected ? candidates.filter(m => selected.includes(m.key) || (m.origin === 'SOURCE' && Number.isFinite(cutoff) && Date.parse(m.date)>cutoff)) : candidates.length === line.quantity ? candidates : [];
        if (matched.length !== line.quantity) unresolved += line.quantity;
        else for (const m of matched) { if(Date.parse(m.date)<=now.getTime())details.set(m.key, m); claimed.add(m.key); }
      } else {
        const m = catalog.get(line.key);
        if (m) details.set(m.key, { ...m, ...projectStudentAttendance(line) });
        else if (!line.date || !Number.isFinite(Date.parse(line.date))) unresolved += line.quantity;
        else details.set(line.key, { key: line.key, date: line.date, label: line.label.split(' — ')[0], user_id: slip.user_id ?? '', kind: line.kind as PayrollMeeting['kind'], delivery: /OFFLINE/.test(line.details) ? 'OFFLINE' : 'ONLINE', students: line.students ?? 0, cancelled: line.details.includes('dibatalkan'), substitute: line.details.includes('Coach pengganti') || undefined, ...projectStudentAttendance(line) });
      }
    }
    slip.attendance_details = [...details.values()].sort((a,b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
    slip.unresolved_attendance = unresolved;
  }
}
