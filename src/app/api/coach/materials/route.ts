import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { classesDao, materialsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

const createMaterialSchema = z.object({
  classId: z.string().uuid(),
  sessionId: z.string().uuid().nullable().optional(),
  blockId: z.string().uuid().nullable().optional(),
  title: z.string().min(3),
  description: z.string().max(400).optional(),
  fileUrl: z.string().url().optional(),
  coachNote: z.string().max(400).optional(),
  visibleFromSessionId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request) {
  const session = await getSessionOrThrow();
  const coachSession = await assertRole(session, 'COACH');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createMaterialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const classRecord = await classesDao.getClassById(input.classId);
  if (!classRecord) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 });
  }

  if (classRecord.coach_id !== coachSession.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const material = await materialsDao.createMaterial({
    classId: input.classId,
    sessionId: input.sessionId ?? null,
    blockId: input.blockId ?? null,
    title: input.title,
    description: input.description ?? null,
    fileUrl: input.fileUrl ?? null,
    coachNote: input.coachNote ?? null,
    visibleFromSessionId: input.visibleFromSessionId ?? null,
    uploadedByUserId: coachSession.user.id,
    uploadedByRole: 'COACH',
  });

  return NextResponse.json({ material });
}
