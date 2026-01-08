"use server";

import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { classLessonsDao, classesDao } from '@/lib/dao';
import { deleteLessonExample, uploadLessonExample } from '@/lib/storage';

type RouteContext = {
  params: Promise<{ lessonId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
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

  const classBlock = await classesDao.getClassBlockById(lesson.class_block_id);
  if (!classBlock) {
    return NextResponse.json({ error: 'Class block not found' }, { status: 404 });
  }

  const klass = await classesDao.getClassById(classBlock.class_id);
  if (!klass) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 });
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
  const storagePath = `${klass.id}/${decodedLessonId}/${Date.now()}-${sanitizedFilename}`;

  try {
    if (lesson.coach_example_storage_path) {
      await deleteLessonExample(lesson.coach_example_storage_path);
    }
  } catch (error) {
    console.error('Failed to delete previous lesson example', error);
  }

  const publicUrl = await uploadLessonExample(storagePath, buffer, contentType);
  await classLessonsDao.updateLessonExample(decodedLessonId, publicUrl, storagePath);

  return NextResponse.json({ url: publicUrl });
}

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

  if (lesson.coach_example_storage_path) {
    try {
      await deleteLessonExample(lesson.coach_example_storage_path);
    } catch (error) {
      console.error('Failed to delete lesson example from storage', error);
    }
  }

  await classLessonsDao.updateLessonExample(decodedLessonId, null, null);

  return NextResponse.json({ success: true });
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}
