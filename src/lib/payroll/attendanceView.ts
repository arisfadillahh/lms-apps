import type { PeriodRecord } from './model';
import { attendanceStatusLabel, hasReasonedAttendanceOverride, projectStudentAttendance } from './studentAttendanceState';

const attendanceKinds = new Set(['CLASS_SUMMARY', 'WEEKLY', 'EKSKUL', 'TRIAL', 'EVENT', 'TRAINING_ONLINE', 'TRAINING_OFFLINE', 'OBSERVATION_ONLINE', 'OBSERVATION_OFFLINE']);
/** Coach leads receive operational fields only, never slips or financial audit payloads. */
export function attendancePeriodView(record: PeriodRecord) {
  const p = record.document;
  return {
    id: p.id, revision: record.revision, status: p.status, pic_id: p.pic_id ?? null,
    starts_at: p.starts_at, ends_at: p.ends_at, correction_deadline: p.correction_deadline,
    overrides: Object.fromEntries(Object.entries(p.overrides).filter(([key]) => p.slips.some(s => s.kind === 'COACH' && s.lines.some(l => l.key === key && attendanceKinds.has(l.kind)))).map(([key, o]) => [key, { profile_id: o.profile_id, quantity: o.quantity, meeting_keys: o.meeting_keys, selection_cutoff: o.selection_cutoff, excluded: o.excluded, mode: o.mode, teaching_confirmed: o.teaching_confirmed, reason: o.amount === undefined ? o.reason : '' }])),
    corrections: (p.corrections ?? []).map(r => ({ id: r.id, user_id: r.user_id, message: r.message, at: r.at, status: r.status, response: r.response, reviewed_at: r.reviewed_at })),
    warnings: p.warnings.filter(w => /penilaian lengkap|Tidak ada peserta aktif|Pilih mode fulltime|Coach belum terdaftar|Absensi siswa/.test(w)),
    activities: p.slips.filter(s => s.kind === 'COACH').flatMap(s => s.lines.filter(l => attendanceKinds.has(l.kind) && (!l.summary || l.quantity > 0)).map(l => ({
      key: l.key, profile_id: s.profile_id, coach_name: s.name, date: l.date, label: l.label.split(' — ')[0],
      quantity: l.quantity, kind: l.kind, mode: l.mode, students: l.students, summary: l.summary, summary_before: l.summary_before, source_identity: l.source_identity, source_counter: l.source_counter,
      ...projectStudentAttendance(l),
      attendance_override: hasReasonedAttendanceOverride(p.overrides[l.key]),
      excluded: p.overrides[l.key]?.excluded ?? false,
      status: p.overrides[l.key]?.excluded ? 'Dikecualikan' : l.details.includes('dibatalkan') ? 'Dibatalkan' : attendanceStatusLabel(l) ?? (l.details.includes('Coach pengganti') ? 'Coach pengganti' : 'Tercatat'),
    }))),
  };
}
export type AttendancePeriodView = ReturnType<typeof attendancePeriodView>;
