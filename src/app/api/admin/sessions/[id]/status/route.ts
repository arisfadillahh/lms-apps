import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { getSessionOrThrow } from '@/lib/auth';
import { classLessonsDao, sessionsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

type RouteParams = { id: string };
type RouteContext = { params: RouteParams | Promise<RouteParams> };

const updateSessionStatusSchema = z.object({
  status: z.enum(['SCHEDULED', 'CANCELLED', 'COMPLETED']),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, ['ADMIN', 'COACH']);

  const params = await context.params;
  const sessionId = params.id;

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = updateSessionStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const sessionRecord = await sessionsDao.getSessionById(sessionId);
    if (!sessionRecord) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await sessionsDao.updateSessionStatus(sessionId, parsed.data.status);

    // When a session is COMPLETED, ensure rolling 12-week schedule is maintained
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
    
    revalidatePath('/admin/classes/[id]', 'page');
    revalidatePath('/admin/classes');

    
  } catch (error) {
    console.error('Failed to update session status', error);
    return NextResponse.json({ error: 'Failed to update session status' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
