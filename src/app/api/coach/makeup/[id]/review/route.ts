import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { classesDao, makeUpTasksDao, sessionsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

const reviewSchema = z.object({
  status: z.literal('REVIEWED'),
  feedback: z.string().max(400).optional(),
});

type RouteProps = {
  params: { id: string };
};

export async function POST(request: Request, { params }: RouteProps) {
  const session = await getSessionOrThrow();
  const coachSession = await assertRole(session, 'COACH');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const makeUpTask = await makeUpTasksDao.getMakeUpTaskById(params.id);
  if (!makeUpTask) {
    return NextResponse.json({ error: 'Make-up task not found' }, { status: 404 });
  }

  const sessionRecord = await sessionsDao.getSessionById(makeUpTask.session_id);
  if (!sessionRecord) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const classRecord = await classesDao.getClassById(sessionRecord.class_id);
  if (!classRecord || classRecord.coach_id !== coachSession.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await makeUpTasksDao.reviewMakeUpTask({
    taskId: makeUpTask.id,
    reviewedByCoachId: coachSession.user.id,
    feedback: parsed.data.feedback ?? null,
    status: 'REVIEWED',
  });

  return NextResponse.json({ success: true });
}
