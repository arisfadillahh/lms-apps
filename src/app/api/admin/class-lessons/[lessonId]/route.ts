"use server";

import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { classLessonsDao, classesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { deleteLessonExample } from '@/lib/storage';
import { autoAssignLessonsForClass } from '@/lib/services/lessonAutoAssign';

type RouteContext = {
  params: Promise<{ lessonId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const { lessonId } = await context.params;
  const decodedLessonId = decodeURIComponent(lessonId ?? '').trim();
  if (!isValidUuid(decodedLessonId)) {
    return NextResponse.json({ error: 'Invalid lesson id' }, { status: 400 });
  }

  const lesson = await classLessonsDao.getClassLessonById(decodedLessonId);
  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
  }
  const classBlock = lesson.class_block_id ? await classesDao.getClassBlockById(lesson.class_block_id) : null;

  if (lesson.coach_example_storage_path) {
    try {
      await deleteLessonExample(lesson.coach_example_storage_path);
    } catch (error) {
      console.error('Failed to delete lesson example from storage', {
        lessonId: lesson.id,
        error,
      });
    }
  }

  await classLessonsDao.deleteClassLesson(decodedLessonId);

  if (classBlock) {
    try {
      await autoAssignLessonsForClass(classBlock.class_id);
    } catch (error) {
      console.error('[class-lessons/delete] Failed to auto-assign lessons after deletion', error);
    }
  }

  return NextResponse.json({ success: true });
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}
