import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { classesDao, sessionsDao } from '@/lib/dao';
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API /coach/sessions/[id]/status error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
