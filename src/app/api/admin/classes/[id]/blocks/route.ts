import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao, classLessonsDao, classesDao, lessonTemplatesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { instantiateClassBlockSchema } from '@/lib/validation/admin';
import { autoAssignLessonsForClass } from '@/lib/services/lessonAutoAssign';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const resolvedParams = await context.params;
  const rawId = resolvedParams.id ?? '';
  const classId = decodeURIComponent(rawId).trim();
  if (!classId || !isValidUuid(classId)) {
    return NextResponse.json({ error: 'Invalid class id' }, { status: 400 });
  }
  const klass = await classesDao.getClassById(classId);
  if (!klass) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 });
  }

  if (klass.type !== 'WEEKLY') {
    return NextResponse.json({ error: 'Instansiasi block hanya untuk kelas WEEKLY' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = instantiateClassBlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const block = await blocksDao.getBlockById(parsed.data.blockId);
  if (!block) {
    return NextResponse.json({ error: 'Block template tidak ditemukan' }, { status: 404 });
  }

  if (klass.level_id && block.level_id !== klass.level_id) {
    return NextResponse.json({ error: 'Block tidak sesuai dengan level kelas' }, { status: 400 });
  }

  const lessons = await lessonTemplatesDao.listLessonsByBlock(block.id);
  const sessionSpan = Math.max(lessons.length, 1);
  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + (sessionSpan - 1) * 7);

  const classBlock = await classesDao.createClassBlock({
    classId,
    blockId: block.id,
    startDate: formatDateOnly(startDate),
    endDate: formatDateOnly(endDate),
    pitchingDayDate: formatDateOnly(endDate),
    status: 'UPCOMING',
  });
  await classLessonsDao.createClassLessons(
    lessons.map((lesson) => ({
      class_block_id: classBlock.id,
      lesson_template_id: lesson.id,
      title: lesson.title,
      summary: lesson.summary ?? null,
      order_index: lesson.order_index,
      make_up_instructions: lesson.make_up_instructions ?? null,
      slide_url: lesson.slide_url ?? null,
      coach_example_url: lesson.example_url ?? null,
      coach_example_storage_path: lesson.example_storage_path ?? null,
    })),
  );

  try {
    await autoAssignLessonsForClass(classId);
  } catch (error) {
    console.error('[class-blocks] Failed to auto-assign lessons to sessions', error);
  }

  return NextResponse.json({ classBlockId: classBlock.id });
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
