import { NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { getSessionOrThrow } from '@/lib/auth';
import { classLessonsDao, classesDao, sessionsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

const updateStatusSchema = z.object({
  status: z.enum(['COMPLETED', 'CANCELLED']),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getSessionOrThrow();
    const coachSession = await assertRole(session, 'COACH');

    const params = await context.params;
    const sessionId = params.id;

    // Validate UUID format to prevent database errors
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    const sessionRecord = await sessionsDao.getSessionById(sessionId);
    if (!sessionRecord) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const classRecord = await classesDao.getClassById(sessionRecord.class_id);
    if (!classRecord) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    const isAssignedCoach =
      classRecord.coach_id === coachSession.user.id || sessionRecord.substitute_coach_id === coachSession.user.id;

    if (!isAssignedCoach) {
      return NextResponse.json({ error: 'Forbidden: Not your class' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    await sessionsDao.updateSessionStatus(sessionId, parsed.data.status);

    if (parsed.data.status === 'COMPLETED') {
      const { coderSessionAccessDao } = await import('@/lib/dao');
      await coderSessionAccessDao.grantSessionAccessForCompletedSession(sessionId);
      const { ensureFutureSessions } = await import('@/lib/dao/sessionsDao');
      await ensureFutureSessions(sessionRecord.class_id);
    }

    if (parsed.data.status === 'CANCELLED') {
      await classLessonsDao.unassignLessonsFromSessions([sessionId]);
    }

    const { autoAssignLessonsForClass, syncBlockStatusesForClass } = await import('@/lib/services/lessonAutoAssign');
    const autoAssignMode =
      parsed.data.status === 'CANCELLED' || sessionRecord.status === 'CANCELLED'
        ? 'rebuild_future'
        : 'preserve';
    await autoAssignLessonsForClass(sessionRecord.class_id, { mode: autoAssignMode });
    await syncBlockStatusesForClass(sessionRecord.class_id);

    if (parsed.data.status === 'COMPLETED') {
      const { generateDraftReportsForClasses } = await import('@/lib/services/aiReports');
      await generateDraftReportsForClasses([sessionRecord.class_id]);
    }

    revalidatePath('/coach/classes/[id]', 'page');
    revalidatePath('/coach/classes');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API /coach/sessions/[id]/status error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
