"use server";

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { classLessonsDao, lessonTemplatesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const urlSchema = z.object({
  url: z.string().url('URL tidak valid').or(z.literal('')).nullable(),
});

export async function POST(request: Request, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const { id } = await context.params;
  const decodedLessonId = decodeURIComponent(id ?? '').trim();
  if (!isValidUuid(decodedLessonId)) {
    return NextResponse.json({ error: 'Invalid lesson id' }, { status: 400 });
  }

  const template = await lessonTemplatesDao.getLessonTemplateById(decodedLessonId);
  if (!template) {
    return NextResponse.json({ error: 'Lesson template not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = urlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'URL tidak valid' }, { status: 400 });
  }

  const exampleUrl = parsed.data.url || null;

  await lessonTemplatesDao.updateLessonTemplate(decodedLessonId, {
    exampleUrl,
    exampleStoragePath: null,
  });
  await classLessonsDao.syncTemplateLessonExample(decodedLessonId, exampleUrl, null);

  return NextResponse.json({ url: exampleUrl });
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const { id } = await context.params;
  const decodedLessonId = decodeURIComponent(id ?? '').trim();
  if (!isValidUuid(decodedLessonId)) {
    return NextResponse.json({ error: 'Invalid lesson id' }, { status: 400 });
  }

  const template = await lessonTemplatesDao.getLessonTemplateById(decodedLessonId);
  if (!template) {
    return NextResponse.json({ error: 'Lesson template not found' }, { status: 404 });
  }

  await lessonTemplatesDao.updateLessonTemplate(decodedLessonId, {
    exampleUrl: null,
    exampleStoragePath: null,
  });
  await classLessonsDao.syncTemplateLessonExample(decodedLessonId, null, null);

  return NextResponse.json({ success: true });
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}
