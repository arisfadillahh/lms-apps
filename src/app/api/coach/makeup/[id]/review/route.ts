import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { classesDao, makeUpTasksDao, notificationsDao, sessionsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

const reviewSchema = z.object({
  status: z.enum(['REVIEWED', 'APPROVED', 'REJECTED']),
  feedback: z.string().max(400).optional(),
});

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, props: RouteProps) {
  const params = await props.params;
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

  // Build feedback with optional prefix to record approve/reject intent
  const statusLabel = parsed.data.status === 'APPROVED' ? '[APPROVED] ' : parsed.data.status === 'REJECTED' ? '[REJECTED] ' : '';
  const fullFeedback = statusLabel + (parsed.data.feedback ?? '');

  await makeUpTasksDao.reviewMakeUpTask({
    taskId: makeUpTask.id,
    reviewedByCoachId: coachSession.user.id,
    feedback: fullFeedback.trim() || null,
    // DB enum only supports REVIEWED; store APPROVED/REJECTED as REVIEWED
    status: 'REVIEWED',
  });

  try {
    const isRevision = parsed.data.status === 'REJECTED';
    await notificationsDao.createNotification(
      makeUpTask.coder_id,
      isRevision ? 'Tugas susulan perlu diperbaiki' : 'Tugas susulan sudah direview',
      isRevision
        ? `Coach meminta perbaikan tugas susulan ${classRecord.name}. Buka tugas untuk melihat feedback.`
        : `Tugas susulan ${classRecord.name} sudah direview oleh Coach.`,
      'MAKEUP_REVIEWED',
      {
        actionUrl: '/coder/makeup',
        category: 'TASK',
        priority: isRevision ? 'HIGH' : 'NORMAL',
        dedupeKey: `makeup-review-${makeUpTask.id}-${parsed.data.status}`,
        push: true,
        pushTag: `makeup-${makeUpTask.id}`,
      },
    );
  } catch (notificationError) {
    console.error('[MakeUpReview] Failed to notify Coder', notificationError);
  }

  return NextResponse.json({ success: true, status: parsed.data.status });
}
