import { redirect } from 'next/navigation';

import { getSessionOrThrow } from '@/lib/auth';
import { attendanceDao, sessionsDao, classesDao, reportsDao } from '@/lib/dao';
import { filterEvaluationEnrollmentsForSession } from '@/lib/services/enrollmentEligibility';
import { computeLessonSchedule, formatLessonTitle } from '@/lib/services/lessonScheduler';

import EvaluationFormClient from './EvaluationFormClient';

export default async function CoachSessionEvaluationPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const sessionUser = await getSessionOrThrow();
  const coachId = sessionUser.user.id;
  const resolvedParams = await params;
  const { sessionId } = resolvedParams;

  const session = await sessionsDao.getSessionById(sessionId);
  if (!session || session.status !== 'COMPLETED') {
    redirect('/coach/rubrics');
  }

  const klass = await classesDao.getClassById(session.class_id);
  if (!klass || (klass.coach_id !== coachId && session.substitute_coach_id !== coachId)) {
    redirect('/coach/rubrics');
  }

  const lessonMap = await computeLessonSchedule(klass.id, klass.level_id, klass.ekskul_lesson_plan_id);
  const slot = lessonMap.get(sessionId);
  if (!slot) redirect('/coach/rubrics');

  const attendanceRecords = await attendanceDao.listAttendanceBySession(session.id);

  // Include a newly registered Coder when their actual attendance was backfilled as PRESENT.
  const enrollments = await classesDao.listEnrollmentsByClass(klass.id);
  const activeStudentIds = filterEvaluationEnrollmentsForSession(
    enrollments,
    session.date_time,
    attendanceRecords,
  ).map(e => e.coder_id);

  if (activeStudentIds.length === 0) {
    redirect('/coach/rubrics');
  }
  
  // Need student names 
  const { data: students } = await (await import('@/lib/supabaseServer')).getSupabaseAdmin()
    .from('users')
    .select('id, full_name')
    .in('id', activeStudentIds);

  const criteriaList = await reportsDao.getEvaluationCriteria();

  return (
    <>
      <EvaluationFormClient 
        sessionId={sessionId}
        students={students || []}
        criteriaList={criteriaList}
        lessonTitle={formatLessonTitle(slot)}
        blockName={slot.block.name || 'Unknown Block'}
      />
    </>
  );
}
