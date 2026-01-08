"use server";

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { classLessonsDao, classesDao, lessonTemplatesDao } from '@/lib/dao';
import { autoAssignLessonsForClass } from '@/lib/services/lessonAutoAssign';

const bodySchema = z.object({
  lessonTemplateId: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{ id: string; blockId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const resolvedParams = await context.params;
  const rawClassId = resolvedParams.id ?? '';
  const rawBlockId = resolvedParams.blockId ?? '';
  const classId = decodeURIComponent(rawClassId).trim();
  const classBlockId = decodeURIComponent(rawBlockId).trim();

  if (!isValidUuid(classId) || !isValidUuid(classBlockId)) {
    return NextResponse.json({ error: 'Invalid identifier' }, { status: 400 });
  }

  const klass = await classesDao.getClassById(classId);
  if (!klass) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 });
  }

  const classBlock = await classesDao.getClassBlockById(classBlockId);
  if (!classBlock || classBlock.class_id !== classId) {
    return NextResponse.json({ error: 'Class block not found' }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const template = await lessonTemplatesDao.getLessonTemplateById(parsed.data.lessonTemplateId);
  if (!template) {
    return NextResponse.json({ error: 'Lesson template not found' }, { status: 404 });
  }

  if (template.block_id !== classBlock.block_id) {
    return NextResponse.json({ error: 'Lesson template does not belong to this block' }, { status: 400 });
  }

  const existingLessons = await classLessonsDao.listLessonsByClassBlock(classBlockId);
  if (existingLessons.some((lesson) => lesson.lesson_template_id === template.id)) {
    return NextResponse.json({ error: 'Lesson already exists in this class block' }, { status: 409 });
  }

  if (existingLessons.some((lesson) => lesson.order_index === template.order_index)) {
    return NextResponse.json(
      { error: 'Another lesson already uses this order index in the class block' },
      { status: 409 },
    );
  }

  const created = await classLessonsDao.createClassLessons([
    {
      class_block_id: classBlockId,
      lesson_template_id: template.id,
      title: template.title,
      summary: template.summary ?? null,
      order_index: template.order_index,
      make_up_instructions: template.make_up_instructions ?? null,
      slide_url: template.slide_url ?? null,
      coach_example_url: template.example_url ?? null,
      coach_example_storage_path: template.example_storage_path ?? null,
    },
  ]);

  try {
    await autoAssignLessonsForClass(classId);
  } catch (error) {
    console.error('[class-block-lessons] Failed to auto-assign lessons after adding lesson', error);
  }

  return NextResponse.json({ lesson: created[0] }, { status: 201 });
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}
