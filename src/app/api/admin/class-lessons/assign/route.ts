import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { classLessonsDao, classesDao, sessionsDao } from '@/lib/dao';
import { autoAssignLessonsForClass } from '@/lib/services/lessonAutoAssign';

const assignSchema = z.object({
  lessonId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { lessonId, sessionId } = parsed.data;
  const lesson = await classLessonsDao.getClassLessonById(lessonId);
  if (!lesson) {
    return NextResponse.json({ error: 'Lesson tidak ditemukan' }, { status: 404 });
  }

  if (!lesson.class_block_id) {
    return NextResponse.json({ error: 'Lesson tidak terkait block' }, { status: 400 });
  }

  const classBlock = await classesDao.getClassBlockById(lesson.class_block_id);
  if (!classBlock) {
    return NextResponse.json({ error: 'Block untuk lesson ini tidak ditemukan' }, { status: 404 });
  }

  const targetSession = await sessionsDao.getSessionById(sessionId);
  if (!targetSession) {
    return NextResponse.json({ error: 'Session tidak ditemukan' }, { status: 404 });
  }

  if (targetSession.class_id !== classBlock.class_id) {
    return NextResponse.json({ error: 'Session tidak berada pada kelas yang sama' }, { status: 400 });
  }

  const existingLessonForSession = await classLessonsDao.getClassLessonBySession(sessionId);
  if (existingLessonForSession && existingLessonForSession.id !== lesson.id) {
    await classLessonsDao.clearLessonSession(existingLessonForSession.id);
  }

  if (lesson.session_id && lesson.session_id !== sessionId) {
    await classLessonsDao.clearLessonSession(lesson.id);
  }

  await classLessonsDao.assignLessonToSession(lesson.id, sessionId, targetSession.date_time);

  try {
    await autoAssignLessonsForClass(classBlock.class_id);
  } catch (error) {
    console.error('[class-lessons/assign] Failed to re-run auto-assign after manual pairing', error);
  }

  return NextResponse.json({ success: true });
}
