import type { PeriodRecord } from './model';

const attendanceKinds = new Set(['CLASS_SUMMARY', 'WEEKLY', 'EKSKUL', 'TRIAL', 'EVENT', 'TRAINING_ONLINE', 'TRAINING_OFFLINE', 'OBSERVATION_ONLINE', 'OBSERVATION_OFFLINE']);
/** Coach leads receive operational fields only, never slips or financial audit payloads. */
export function attendancePeriodView(record: PeriodRecord) {
  const p = record.document;
  return {
    id: p.id, revision: record.revision, status: p.status, pic_id: p.pic_id ?? null,
    starts_at: p.starts_at, ends_at: p.ends_at, correction_deadline: p.correction_deadline,
    corrections: (p.corrections ?? []).map(r => ({ id: r.id, user_id: r.user_id, message: r.message, at: r.at, status: r.status, response: r.response, reviewed_at: r.reviewed_at })),
    warnings: p.warnings.filter(w => /penilaian lengkap|Tidak ada peserta aktif|Pilih mode fulltime|Coach belum terdaftar/.test(w)),
    activities: p.slips.filter(s => s.kind === 'COACH').flatMap(s => s.lines.filter(l => attendanceKinds.has(l.kind) && (!l.summary || l.quantity > 0)).map(l => ({
      key: l.key, profile_id: s.profile_id, coach_name: s.name, date: l.date, label: l.label.split(' — ')[0],
      quantity: l.quantity, kind: l.kind, mode: l.mode, students: l.students,
      excluded: p.overrides[l.key]?.excluded ?? false,
      status: p.overrides[l.key]?.excluded ? 'Dikecualikan' : l.details.includes('dibatalkan') ? 'Dibatalkan' : l.details.includes('Coach pengganti') ? 'Coach pengganti' : 'Tercatat',
    }))),
  };
}
export type AttendancePeriodView = ReturnType<typeof attendancePeriodView>;
