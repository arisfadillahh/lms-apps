import type { EnrollmentRecord } from '@/lib/dao/classesDao';

export function isEnrollmentActiveForSession(enrollment: EnrollmentRecord, sessionDateTime: string | null | undefined) {
  const sessionTime = sessionDateTime ? new Date(sessionDateTime).getTime() : NaN;
  const enrolledTime = enrollment.enrolled_at ? new Date(enrollment.enrolled_at).getTime() : NaN;
  const endedTime = enrollment.ended_at ? new Date(enrollment.ended_at).getTime() : NaN;

  if (!Number.isFinite(sessionTime) || !Number.isFinite(enrolledTime)) {
    return enrollment.status === 'ACTIVE';
  }
  if (enrolledTime > sessionTime) return false;
  if (Number.isFinite(endedTime)) return sessionTime <= endedTime;
  return enrollment.status === 'ACTIVE';
}

export function filterActiveEnrollmentsForSession(
  enrollments: EnrollmentRecord[],
  sessionDateTime: string | null | undefined,
) {
  return enrollments.filter((enrollment) => isEnrollmentActiveForSession(enrollment, sessionDateTime));
}

type SessionAttendanceEvidence = {
  coder_id: string;
  status: string;
};

export function filterEvaluationEnrollmentsForSession(
  enrollments: EnrollmentRecord[],
  sessionDateTime: string | null | undefined,
  attendanceRecords: SessionAttendanceEvidence[],
) {
  const attendedCoderIds = new Set(attendanceRecords.map((record) => record.coder_id));

  return enrollments.filter((enrollment) => (
    isEnrollmentActiveForSession(enrollment, sessionDateTime)
    || (enrollment.status === 'ACTIVE' && attendedCoderIds.has(enrollment.coder_id))
  ));
}

export function isEnrollmentCurrentForUpcomingSession(
  enrollment: EnrollmentRecord,
  sessionDateTime: string | null | undefined,
) {
  return enrollment.status === 'ACTIVE'
    && enrollment.ended_at === null
    && isEnrollmentActiveForSession(enrollment, sessionDateTime);
}

export function isClassActiveForOperationalMessages(
  lifecycleStatus: string | null | undefined,
) {
  return lifecycleStatus === undefined || lifecycleStatus === null || lifecycleStatus === 'ACTIVE';
}
