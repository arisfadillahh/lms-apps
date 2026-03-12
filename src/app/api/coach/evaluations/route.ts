import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { sessionsDao, reportsDao, classesDao } from '@/lib/dao';
import type { UpsertLessonEvaluationInput } from '@/lib/dao/reportsDao';

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

    // Flatten { coderId: { criteriaId: score } } into flat array
    const evaluationsToUpsert: UpsertLessonEvaluationInput[] = [];
    
    for (const [coderId, criteriaScores] of Object.entries(scores)) {
      for (const [criteriaId, scoreVal] of Object.entries(criteriaScores as Record<string, string>)) {
        const score = parseInt(scoreVal, 10);
        if (!isNaN(score) && score >= 1 && score <= 10) {
          evaluationsToUpsert.push({
            sessionId,
            coderId,
            criteriaId,
            score
          });
        }
      }
    }

    if (evaluationsToUpsert.length === 0) {
      return NextResponse.json({ error: 'No valid scores provided' }, { status: 400 });
    }

    // Note: We need the server to be restarted to pick up the correct SUPABASE_SERVICE_ROLE_KEY
    // if it was just changed in the .env file.
    await reportsDao.upsertLessonEvaluations(evaluationsToUpsert);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving evaluations:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
