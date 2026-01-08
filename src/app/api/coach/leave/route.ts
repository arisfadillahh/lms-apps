import { differenceInHours } from 'date-fns';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { coachLeaveDao, sessionsDao, classesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  note: z
    .string()
    .max(400)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export async function POST(request: Request) {
  const session = await getSessionOrThrow();
  const coachSession = await assertRole(session, 'COACH');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const sessionRecord = await sessionsDao.getSessionById(parsed.data.sessionId);
  if (!sessionRecord) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const classRecord = await classesDao.getClassById(sessionRecord.class_id);
  if (!classRecord || classRecord.coach_id !== coachSession.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sessionDate = new Date(sessionRecord.date_time);
  const now = new Date();
  const minLeadHours = 7 * 24;
  const diffHours = differenceInHours(sessionDate, now);
  if (diffHours < minLeadHours) {
    return NextResponse.json({ error: 'Leave request must be submitted at least 7 days before the session' }, { status: 400 });
  }

  const existingRequests = await coachLeaveDao.listLeaveRequestsForCoach(coachSession.user.id);
  if (existingRequests.some((request) => request.session_id === parsed.data.sessionId && request.status === 'PENDING')) {
    return NextResponse.json({ error: 'Leave request already submitted for this session' }, { status: 409 });
  }

  const requestRecord = await coachLeaveDao.createLeaveRequest({
    coachId: coachSession.user.id,
    sessionId: parsed.data.sessionId,
    note: parsed.data.note ?? null,
  });

  return NextResponse.json({ request: requestRecord }, { status: 201 });
}
