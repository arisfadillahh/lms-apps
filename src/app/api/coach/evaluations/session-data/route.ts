import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { attendanceDao, sessionsDao, classesDao, reportsDao } from '@/lib/dao';
import { filterActiveEnrollmentsForSession } from '@/lib/services/enrollmentEligibility';
import { computeLessonSchedule, formatLessonTitle } from '@/lib/services/lessonScheduler';

export async function GET(req: Request) {
  try {
    const sessionUser = await getSessionOrThrow();
    if (!sessionUser || sessionUser.user.role !== 'COACH') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    const coachId = sessionUser.user.id;

    const session = await sessionsDao.getSessionById(sessionId);
    if (!session || session.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Session not found or not completed' }, { status: 404 });
    }

    const klass = await classesDao.getClassById(session.class_id);
    if (!klass || (klass.coach_id !== coachId && session.substitute_coach_id !== coachId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const lessonMap = await computeLessonSchedule(klass.id, klass.level_id, klass.ekskul_lesson_plan_id);
    const slot = lessonMap.get(sessionId);
    if (!slot) {
      return NextResponse.json({ error: 'Lesson slot not found' }, { status: 404 });
    }

    // Only students who were already enrolled when this session happened.
    const enrollments = await classesDao.listEnrollmentsByClass(klass.id);
    const activeStudentIds = filterActiveEnrollmentsForSession(enrollments, session.date_time).map(e => e.coder_id);

    if (activeStudentIds.length === 0) {
      return NextResponse.json({ error: 'No active students' }, { status: 404 });
    }

    const attendanceRecords = await attendanceDao.listAttendanceBySession(session.id);
    const attendedCoderIds = new Set(attendanceRecords.map((record) => record.coder_id));
    const missingAttendance = activeStudentIds.filter((coderId) => !attendedCoderIds.has(coderId));
    if (missingAttendance.length > 0) {
      return NextResponse.json(
        {
          error: `Lengkapi presensi ${missingAttendance.length} coder dulu sebelum memberi nilai.`,
          missingAttendanceCount: missingAttendance.length,
        },
        { status: 409 },
      );
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: students } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', activeStudentIds);

    const criteriaList = await reportsDao.getEvaluationCriteria();

    return NextResponse.json({
      sessionId,
      students: students || [],
      criteriaList,
      lessonTitle: formatLessonTitle(slot),
      blockName: slot.block.name || 'Unknown Block'
    });
  } catch (error: unknown) {
    console.error('Error fetching session data:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
