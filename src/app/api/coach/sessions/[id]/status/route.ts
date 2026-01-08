import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { classesDao, sessionsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

const updateStatusSchema = z.object({
  status: z.enum(['COMPLETED', 'CANCELLED']),
});

type RouteContext = {
  params: { id: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSessionOrThrow();
  const coachSession = await assertRole(session, 'COACH');

  const sessionId = params.id;
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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
}
