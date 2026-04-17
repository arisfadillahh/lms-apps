import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao, classesDao, coderProgressDao, coderSessionAccessDao, usersDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { enrollCoderSchema, updateEnrollmentStatusSchema } from '@/lib/validation/admin';
import { computeLessonSchedule } from '@/lib/services/lessonScheduler';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const resolvedParams = await context.params;
  const rawId = resolvedParams?.id ?? '';
  const classIdParam = decodeURIComponent(rawId).trim();

  if (!classIdParam || !isValidUuid(classIdParam)) {
    return NextResponse.json({ error: 'Invalid class id parameter' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = enrollCoderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const coder = await usersDao.getUserById(parsed.data.coderId);
  if (!coder || coder.role !== 'CODER') {
    return NextResponse.json({ error: 'Coder not found' }, { status: 404 });
  }

  const klass = await classesDao.getClassById(classIdParam);
  if (!klass) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 });
  }
  if (klass.type === 'WEEKLY') {
    if (!klass.level_id) {
      return NextResponse.json({ error: 'Class level missing' }, { status: 400 });
    }

    const [levelBlocks, classBlocks] = await Promise.all([
      blocksDao.listBlocksByLevel(klass.level_id),
      classesDao.getClassBlocks(classIdParam),
    ]);

    if (levelBlocks.length === 0) {
      return NextResponse.json({ error: 'No curriculum blocks configured for this level' }, { status: 400 });
    }

    try {
      const enrollment = await classesDao.enrollCoder({
        classId: classIdParam,
        coderId: parsed.data.coderId,
      });

      const sortedClassBlocks = [...classBlocks].sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      );
      const [sessions, lessonMap] = await Promise.all([
        import('@/lib/dao/sessionsDao').then((m) => m.listSessionsByClass(classIdParam)),
        computeLessonSchedule(classIdParam, klass.level_id),
      ]);
      const scheduledSessions = sessions
        .filter((sessionRow) => sessionRow.status !== 'CANCELLED')
        .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
      const nextScheduledEntry = scheduledSessions.find(
        (sessionRow) => sessionRow.status !== 'COMPLETED' && lessonMap.has(sessionRow.id),
      );
      const lastCompletedEntry = [...scheduledSessions]
        .filter((sessionRow) => sessionRow.status === 'COMPLETED' && lessonMap.has(sessionRow.id))
        .pop();
      const currentBlockId =
        (nextScheduledEntry ? lessonMap.get(nextScheduledEntry.id)?.block.id : null) ??
        (lastCompletedEntry ? lessonMap.get(lastCompletedEntry.id)?.block.id : null) ??
        classBlocks.find((block) => block.status === 'CURRENT')?.block_id ??
        sortedClassBlocks[0]?.block_id ??
        null;

      await coderProgressDao.ensureJourneyForCoder({
        coderId: parsed.data.coderId,
        levelId: klass.level_id,
        blocks: levelBlocks,
        entryBlockId: currentBlockId,
      });

      const enrollmentAt = new Date(enrollment.enrolled_at);
      const lastSeenEntry = [...scheduledSessions]
        .filter(
          (sessionRow) =>
            new Date(sessionRow.date_time).getTime() <= enrollmentAt.getTime() && lessonMap.has(sessionRow.id),
        )
        .pop();
      const firstUpcomingEntry = scheduledSessions.find(
        (sessionRow) =>
          new Date(sessionRow.date_time).getTime() > enrollmentAt.getTime() && lessonMap.has(sessionRow.id),
      );
      const entryBlockId =
        (lastSeenEntry ? lessonMap.get(lastSeenEntry.id)?.block.id : null) ??
        (firstUpcomingEntry ? lessonMap.get(firstUpcomingEntry.id)?.block.id : null) ??
        currentBlockId;
      const entryBlock =
        classBlocks.find((block) => block.block_id === entryBlockId) ??
        classBlocks.find((block) => block.status === 'CURRENT') ??
        sortedClassBlocks[0] ??
        null;

      if (entryBlock?.block_id) {
        const catchUpSessionIds = sessions
          .filter((sessionRow) => sessionRow.status !== 'CANCELLED')
          .filter((sessionRow) => new Date(sessionRow.date_time).getTime() <= enrollmentAt.getTime())
          .filter((sessionRow) => lessonMap.get(sessionRow.id)?.block.id === entryBlock.block_id)
          .map((sessionRow) => sessionRow.id);

        await coderSessionAccessDao.grantSessionAccesses(
          catchUpSessionIds.map((sessionId) => ({
            coderId: parsed.data.coderId,
            classId: classIdParam,
            sessionId,
            grantedReason: 'MID_BLOCK_CATCH_UP' as const,
            sourceEnrollmentId: enrollment.id,
          })),
        );
      }

      return NextResponse.json({ enrollment }, { status: 201 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message ?? 'Failed to enroll coder' }, { status: 400 });
    }
  } else {
    // EKSKUL or other types that don't follow the level/block journey structure
    try {
      const enrollment = await classesDao.enrollCoder({
        classId: classIdParam,
        coderId: parsed.data.coderId,
      });
      return NextResponse.json({ enrollment }, { status: 201 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message ?? 'Failed to enroll coder' }, { status: 400 });
    }
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const resolvedParams = await context.params;
  const rawId = resolvedParams?.id ?? '';
  const classIdParam = decodeURIComponent(rawId).trim();

  if (!classIdParam || !isValidUuid(classIdParam)) {
    return NextResponse.json({ error: 'Invalid class id parameter' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = enrollCoderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const coder = await usersDao.getUserById(parsed.data.coderId);
  if (!coder || coder.role !== 'CODER') {
    return NextResponse.json({ error: 'Coder not found' }, { status: 404 });
  }

  const klass = await classesDao.getClassById(classIdParam);
  if (!klass) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 });
  }

  try {
    await classesDao.deleteEnrollment(classIdParam, parsed.data.coderId);
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Failed to remove enrollment' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const resolvedParams = await context.params;
  const rawId = resolvedParams?.id ?? '';
  const classIdParam = decodeURIComponent(rawId).trim();

  if (!classIdParam || !isValidUuid(classIdParam)) {
    return NextResponse.json({ error: 'Invalid class id parameter' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = updateEnrollmentStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const coder = await usersDao.getUserById(parsed.data.coderId);
  if (!coder || coder.role !== 'CODER') {
    return NextResponse.json({ error: 'Coder not found' }, { status: 404 });
  }

  try {
    await classesDao.updateEnrollmentStatus(classIdParam, parsed.data.coderId, parsed.data.status);
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Failed to update enrollment status' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
