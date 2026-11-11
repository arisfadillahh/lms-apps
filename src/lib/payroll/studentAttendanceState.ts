export type StudentAttendanceStatus = 'CONFIRMED' | 'PARTIAL' | 'PENDING' | 'ALL_ABSENT';
export interface StudentAttendanceState { status: StudentAttendanceStatus; expected: number; recorded: number; present: number }
export interface StudentAttendanceMetadata {
  attendance_status?: StudentAttendanceStatus;
  attendance_expected?: number;
  attendance_recorded?: number;
  attendance_present?: number;
  fee_eligible?: boolean;
  teaching_confirmed?: boolean;
}
const recognized = new Set(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED']);

/** Only active enrollments within their enrollment window belong to the roster. */
export function isEnrollmentAtSession(enrollment: { enrolled_at: string; ended_at: string | null; status: string }, dateTime: string): boolean {
  const stamp = Date.parse(dateTime), enrolled = Date.parse(enrollment.enrolled_at);
  return enrollment.status === 'ACTIVE' && Number.isFinite(stamp) && Number.isFinite(enrolled) && enrolled <= stamp &&
    (!enrollment.ended_at || stamp <= Date.parse(enrollment.ended_at));
}

/** Explicit roster attendance only; outsiders and conflicting duplicate rows do not validate a class. */
export function evaluateStudentAttendance(expectedCoderIds: Iterable<string>, rows: readonly { coder_id: string; status: string }[]): StudentAttendanceState {
  const expected = new Set(expectedCoderIds), recorded = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!expected.has(row.coder_id) || !recognized.has(row.status)) continue;
    const statuses = recorded.get(row.coder_id) ?? new Set<string>(); statuses.add(row.status); recorded.set(row.coder_id, statuses);
  }
  let completed = 0, present = 0;
  for (const statuses of recorded.values()) {
    if (statuses.size !== 1) continue;
    completed++;
    if (statuses.has('PRESENT') || statuses.has('LATE')) present++;
  }
  const complete = expected.size > 0 && completed === expected.size;
  return { status: complete ? present ? 'CONFIRMED' : 'ALL_ABSENT' : present ? 'PARTIAL' : 'PENDING', expected: expected.size, recorded: completed, present };
}

/** A staff decision must be explicit and reasoned; changing mode/recipient is not a validation bypass. */
export function hasReasonedAttendanceOverride(override: { reason: string; teaching_confirmed?: boolean; excluded?: boolean; amount?: number } | undefined): boolean {
  return Boolean(override && override.reason.trim().length >= 5 && (typeof override.teaching_confirmed === 'boolean' || override.excluded === true || override.amount !== undefined));
}
export function attendanceValidationWarning(label: string, date: string, metadata: StudentAttendanceMetadata): string | null {
  if (!['PARTIAL', 'PENDING'].includes(metadata.attendance_status ?? '')) return null;
  const day = new Date(date).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short' });
  return `Absensi siswa ${label} (${day}): ${metadata.attendance_recorded ?? 0}/${metadata.attendance_expected ?? 0} terisi. Lengkapi absensi atau catat keputusan beralasan lewat Koreksi aktivitas sebelum finalisasi.`;
}
export function attendanceStatusLabel(metadata: StudentAttendanceMetadata): string | null {
  if (metadata.teaching_confirmed === false) return 'Tidak mengajar (koreksi)';
  if (metadata.teaching_confirmed === true) return 'Mengajar dikonfirmasi admin';
  if (metadata.attendance_status === 'PENDING') return 'Menunggu absensi siswa';
  if (metadata.attendance_status === 'PARTIAL') return 'Absensi siswa belum lengkap';
  if (metadata.attendance_status === 'ALL_ABSENT') return 'Tidak ada siswa hadir';
  return null;
}
export function projectStudentAttendance(metadata: StudentAttendanceMetadata): StudentAttendanceMetadata {
  if (!metadata.attendance_status) return {};
  return { attendance_status: metadata.attendance_status, attendance_expected: metadata.attendance_expected, attendance_recorded: metadata.attendance_recorded, attendance_present: metadata.attendance_present, fee_eligible: metadata.fee_eligible, ...(metadata.teaching_confirmed === undefined ? {} : { teaching_confirmed: metadata.teaching_confirmed }) };
}
