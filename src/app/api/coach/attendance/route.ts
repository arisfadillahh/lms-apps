import { addDays } from 'date-fns';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import {
  attendanceDao,
  classLessonsDao,
  classesDao,
  reportsDao,
  sessionsDao,
  usersDao,
} from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { getAppBaseUrl } from '@/lib/env';
import { sendParentAbsent } from '@/lib/whatsapp/client';

const markAttendanceSchema = z.object({
  sessionId: z.string().uuid(),
  coderId: z.string().uuid(),
  status: z.enum(['PRESENT', 'LATE', 'EXCUSED', 'ABSENT']),
  reason: z
    .string()
    .max(200)
    .optional()
    .transform((value) => value?.trim() ?? undefined),
});

function buildMakeUpUrl(makeUpTaskId: string): string {
  const base = getAppBaseUrl();
  return `${base}/coder/makeup/${makeUpTaskId}`;
}

export async function POST(request: Request) {
  const session = await getSessionOrThrow();
  const coachSession = await assertRole(session, 'COACH');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = markAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { sessionId, coderId, status } = parsed.data;
  const reason = parsed.data.reason ?? null;

  if ((status === 'ABSENT' || status === 'EXCUSED') && (!reason || reason.length === 0)) {
    return NextResponse.json({ error: 'Reason is required for absent or excused status' }, { status: 400 });
  }

  const sessionRecord = await sessionsDao.getSessionById(sessionId);
  if (!sessionRecord) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const classRecord = await classesDao.getClassById(sessionRecord.class_id);
  if (!classRecord) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 });
  }

  const allowedCoachIds = new Set<string>();
  allowedCoachIds.add(classRecord.coach_id);
  if (sessionRecord.substitute_coach_id) {
    allowedCoachIds.add(sessionRecord.substitute_coach_id);
  }

  if (!allowedCoachIds.has(coachSession.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sessionDate = new Date(sessionRecord.date_time);
  const makeUpDueDate = addDays(sessionDate, 7).toISOString();

  let classLesson = await classLessonsDao.getClassLessonBySession(sessionId);
  if (!classLesson) {
    const classBlocks = await classesDao.getClassBlocks(classRecord.id);
    const matchingBlock = classBlocks.find(
      (block) =>
        new Date(block.start_date).getTime() <= sessionDate.getTime() &&
        new Date(block.end_date).getTime() >= sessionDate.getTime(),
    );

    if (matchingBlock) {
      const lessons = await classLessonsDao.listLessonsByClassBlock(matchingBlock.id);
      const sortedLessons = lessons.sort((a, b) => a.order_index - b.order_index);
      const alreadyAssigned = sortedLessons.find((lesson) => lesson.session_id === sessionId);
      if (alreadyAssigned) {
        classLesson = alreadyAssigned;
      } else {
        const firstUnassigned = sortedLessons.find((lesson) => lesson.session_id === null);
        if (firstUnassigned) {
          await classLessonsDao.assignLessonToSession(firstUnassigned.id, sessionId, sessionRecord.date_time);
          classLesson = {
            ...firstUnassigned,
            session_id: sessionId,
            unlock_at: sessionRecord.date_time,
          };
        }
      }
    }
  }

  const makeUpInstructions = classLesson?.make_up_instructions ?? null;

  const result = await attendanceDao.markAttendance({
    sessionId,
    coderId,
    status,
    reason: reason ?? undefined,
    recordedBy: coachSession.user.id,
    makeUpDueDate,
    createMakeUpTask: status === 'ABSENT' || status === 'EXCUSED',
    classLessonId: classLesson?.id,
    instructions: makeUpInstructions ?? undefined,
  });

  if ((status === 'ABSENT' || status === 'EXCUSED') && result.makeUpTask) {
    const coder = await usersDao.getUserById(coderId);
    const parentPhone = coder?.parent_contact_phone;
    if (parentPhone) {
      const logEntry = await reportsDao.logWhatsappEvent({
        category: 'PARENT_ABSENT',
        payload: {
          coderId,
          sessionId,
          makeUpTaskId: result.makeUpTask.id,
          status,
          reason,
          parentPhone,
          instructions: makeUpInstructions,
          dueDate: result.makeUpTask.due_date,
        },
      });

      try {
        const response = await sendParentAbsent({
          coderFullName: coder.full_name,
          className: classRecord.name,
          sessionDateTime: sessionRecord.date_time,
          makeUpUrl: buildMakeUpUrl(result.makeUpTask.id),
          parentPhone,
          status,
          reason,
          instructions: makeUpInstructions ?? undefined,
          dueDate: result.makeUpTask.due_date,
          reminderType: 'INITIAL',
        });
        await reportsDao.updateWhatsappLogStatus(logEntry.id, 'SENT', response as any);
      } catch (error: any) {
        await reportsDao.updateWhatsappLogStatus(logEntry.id, 'FAILED', { message: error.message ?? 'Failed' });
      }
    }
  }

  return NextResponse.json({
    attendance: result.attendance,
    makeUpTaskId: result.makeUpTask?.id ?? null,
  });
}
