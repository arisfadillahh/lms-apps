import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { classesDao, exkulCompetenciesDao, sessionsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

const upsertSchema = z.object({
  sessionId: z.string().uuid(),
  competencies: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const sessionRecord = await sessionsDao.getSessionById(parsed.data.sessionId);
  if (!sessionRecord) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const classRecord = await classesDao.getClassById(sessionRecord.class_id);
  if (!classRecord || classRecord.type !== 'EKSKUL') {
    return NextResponse.json({ error: 'Competency mapping only available for EKSKUL classes' }, { status: 400 });
  }

  const record = await exkulCompetenciesDao.upsertCompetencies(parsed.data.sessionId, parsed.data.competencies);

  return NextResponse.json({ competencies: record });
}
