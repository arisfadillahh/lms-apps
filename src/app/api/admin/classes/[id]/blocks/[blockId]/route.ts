"use server";

import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { classLessonsDao, classesDao } from '@/lib/dao';
import { deleteLessonExample } from '@/lib/storage';
import { autoAssignLessonsForClass } from '@/lib/services/lessonAutoAssign';

type RouteContext = {
  params: Promise<{ id: string; blockId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const resolvedParams = await context.params;
  const classId = decodeURIComponent(resolvedParams.id ?? '').trim();
  const classBlockId = decodeURIComponent(resolvedParams.blockId ?? '').trim();

  if (!isValidUuid(classId) || !isValidUuid(classBlockId)) {
    return NextResponse.json({ error: 'Invalid identifier' }, { status: 400 });
  }

  const classBlock = await classesDao.getClassBlockById(classBlockId);
  if (!classBlock || classBlock.class_id !== classId) {
    return NextResponse.json({ error: 'Class block not found' }, { status: 404 });
  }

  const lessons = await classLessonsDao.listLessonsByClassBlock(classBlockId);
  await Promise.all(
    lessons.map(async (lesson) => {
      const storagePath = lesson.coach_example_storage_path;
      if (!storagePath) {
        return;
      }
      try {
        await deleteLessonExample(storagePath);
      } catch (error) {
        console.error('Failed to delete lesson example during block removal', {
          lessonId: lesson.id,
          error,
        });
      }
    }),
  );

  await classesDao.deleteClassBlock(classBlockId);

  try {
    await autoAssignLessonsForClass(classId);
  } catch (error) {
    console.error('[class-blocks/delete] Failed to auto-assign lessons after deleting block', error);
  }

  return NextResponse.json({ success: true });
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}
