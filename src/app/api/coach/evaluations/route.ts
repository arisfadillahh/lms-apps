import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { attendanceDao, sessionsDao, reportsDao, classesDao } from '@/lib/dao';
import type { UpsertLessonEvaluationInput } from '@/lib/dao/reportsDao';
import { computeLessonSchedule } from '@/lib/services/lessonScheduler';

export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionOrThrow();
    if (!sessionUser || sessionUser.user.role !== 'COACH') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, scores } = body;

    if (!sessionId || !scores) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Verify session belongs to coach
    const session = await sessionsDao.getSessionById(sessionId);
    if (!session || session.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Session not completed or not found' }, { status: 403 });
    }

    const klass = await classesDao.getClassById(session.class_id);
    if (!klass || (klass.coach_id !== sessionUser.user.id && session.substitute_coach_id !== sessionUser.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (klass.type === 'EKSKUL') {
      const lessonMap = await computeLessonSchedule(klass.id, klass.level_id, klass.ekskul_lesson_plan_id);
      if (!lessonMap.has(session.id)) {
        return NextResponse.json({ error: 'Lesson ekskul tidak ditemukan untuk sesi ini.' }, { status: 400 });
      }
    }

    const activeEnrollments = (await classesDao.listEnrollmentsByClass(klass.id)).filter(
      (enrollment) => enrollment.status === 'ACTIVE',
    );
    const activeCoderIds = new Set(activeEnrollments.map((enrollment) => enrollment.coder_id));
    const submittedCoderIds = Object.keys(scores as Record<string, unknown>);
    const unknownCoderIds = submittedCoderIds.filter((coderId) => !activeCoderIds.has(coderId));
    if (unknownCoderIds.length > 0) {
      return NextResponse.json({ error: 'Ada coder yang tidak terdaftar aktif di kelas ini.' }, { status: 400 });
    }

    const attendanceRecords = await attendanceDao.listAttendanceBySession(session.id);
    const attendedCoderIds = new Set(attendanceRecords.map((record) => record.coder_id));
    const missingAttendance = submittedCoderIds.filter((coderId) => !attendedCoderIds.has(coderId));
    if (missingAttendance.length > 0) {
      return NextResponse.json(
        { error: `Lengkapi presensi ${missingAttendance.length} coder dulu sebelum menyimpan nilai.` },
        { status: 409 },
      );
    }

    // Flatten { coderId: { criteriaId: score } } into flat array
    const evaluationsToUpsert: UpsertLessonEvaluationInput[] = [];
    
    for (const [coderId, criteriaScores] of Object.entries(scores)) {
      for (const [criteriaId, scoreVal] of Object.entries(criteriaScores as Record<string, string>)) {
        const score = parseInt(scoreVal, 10);
        if (!isNaN(score) && score >= 1 && score <= 10) {
          evaluationsToUpsert.push({ sessionId, coderId, criteriaId, score });
        }
      }
    }

    if (evaluationsToUpsert.length === 0) {
      return NextResponse.json({ error: 'No valid scores provided' }, { status: 400 });
    }

    // Save lesson evaluations
    await reportsDao.upsertLessonEvaluations(evaluationsToUpsert);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error saving evaluations:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
