import type { EnrollmentRecord } from '@/lib/dao/classesDao';

export function isEnrollmentActiveForSession(enrollment: EnrollmentRecord, sessionDateTime: string | null | undefined) {
  if (enrollment.status !== 'ACTIVE') return false;

  const sessionTime = sessionDateTime ? new Date(sessionDateTime).getTime() : NaN;
  const enrolledTime = enrollment.enrolled_at ? new Date(enrollment.enrolled_at).getTime() : NaN;

  if (!Number.isFinite(sessionTime) || !Number.isFinite(enrolledTime)) return true;
  return enrolledTime <= sessionTime;
}

export function filterActiveEnrollmentsForSession(
  enrollments: EnrollmentRecord[],
  sessionDateTime: string | null | undefined,
) {
  return enrollments.filter((enrollment) => isEnrollmentActiveForSession(enrollment, sessionDateTime));
}
