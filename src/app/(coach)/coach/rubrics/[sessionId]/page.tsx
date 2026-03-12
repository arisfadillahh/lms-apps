import { redirect } from 'next/navigation';

import { getSessionOrThrow } from '@/lib/auth';
import { sessionsDao, classesDao, reportsDao } from '@/lib/dao';
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

  // Check if evaluations already exist (prevent double submission)
  const existingEvaluations = await reportsDao.getLessonEvaluationsBySession(sessionId);
  if (existingEvaluations.length > 0) {
    // Should ideally redirect to a success/view page, but for now back to list
    redirect('/coach/rubrics');
  }

  const lessonMap = await computeLessonSchedule(klass.id, klass.level_id);
  const slot = lessonMap.get(sessionId);
  if (!slot) redirect('/coach/rubrics');

  // We only evaluate ACTIVE students
  const enrollments = await classesDao.listEnrollmentsByClass(klass.id);
  const activeStudentIds = enrollments.filter(e => e.status === 'ACTIVE').map(e => e.coder_id);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1e3a5f', marginBottom: '0.25rem' }}>
          Form Penilaian Lesson
        </h1>
        <p style={{ color: '#64748b', fontSize: '1.05rem', fontWeight: 500 }}>
          {klass.name} • {formatLessonTitle(slot)}
        </p>
      </header>
      
      <div style={{ background: '#e0e7ff', border: '1px solid #c7d2fe', padding: '1rem 1.5rem', borderRadius: '0.75rem', color: '#3730a3', fontSize: '0.9rem', lineHeight: 1.5 }}>
        <strong>Panduan Penilaian:</strong> Berikan nilai antara <b>1 hingga 10</b> untuk setiap kriteria.
        <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
          <li><b>1 - 4:</b> Perlu banyak bimbingan khusus.</li>
          <li><b>5 - 6:</b> Cukup, tapi masih butuh arahan.</li>
          <li><b>7 - 8:</b> Baik, sudah bisa mandiri.</li>
          <li><b>9 - 10:</b> Sangat memuaskan/Outstanding.</li>
        </ul>
      </div>

      <EvaluationFormClient 
        sessionId={sessionId}
        students={students || []}
        criteriaList={criteriaList}
      />
    </div>
  );
}
