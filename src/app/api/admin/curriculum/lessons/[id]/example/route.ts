"use server";

import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { classLessonsDao, lessonTemplatesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { deleteLessonExample, uploadLessonExample } from '@/lib/storage';

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = file.type || 'application/octet-stream';
  const sanitizedFilename = sanitizeFilename(file.name || 'example');
  const storagePath = `lesson-templates/${decodedLessonId}/${Date.now()}-${sanitizedFilename}`;

  try {
    if (template.example_storage_path) {
      await deleteLessonExample(template.example_storage_path);
    }
  } catch (error) {
    console.error('Failed to delete previous template lesson example', error);
  }

  const publicUrl = await uploadLessonExample(storagePath, buffer, contentType);
  await lessonTemplatesDao.updateLessonTemplate(decodedLessonId, {
    exampleUrl: publicUrl,
    exampleStoragePath: storagePath,
  });
  await classLessonsDao.syncTemplateLessonExample(decodedLessonId, publicUrl, storagePath);

  return NextResponse.json({ url: publicUrl });
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

  if (template.example_storage_path) {
    try {
      await deleteLessonExample(template.example_storage_path);
    } catch (error) {
      console.error('Failed to delete template lesson example from storage', error);
    }
  }

  await lessonTemplatesDao.updateLessonTemplate(decodedLessonId, {
    exampleUrl: null,
    exampleStoragePath: null,
  });
  await classLessonsDao.syncTemplateLessonExample(decodedLessonId, null, null);

  return NextResponse.json({ success: true });
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}
