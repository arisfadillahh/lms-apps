import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { classesDao, rubricsDao, usersDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { generateNarrative } from '@/lib/rubrics/narrative';

type CompetencyMap = Record<
  string,
  {
    label: string;
    descriptions?: Record<'A' | 'B' | 'C', string>;
  }
>;

const weeklyRubricSchema = z.object({
  classId: z.string().uuid(),
  blockId: z.string().uuid(),
  coderId: z.string().uuid(),
  grades: z.record(z.string(), z.enum(['A', 'B', 'C'])),
  positiveCharacters: z
    .array(z.string())
    .length(3, 'Positive characters must contain exactly 3 selections'),
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

  const parsed = weeklyRubricSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { classId, blockId, coderId, grades, positiveCharacters } = parsed.data;

  const classRecord = await classesDao.getClassById(classId);
  if (!classRecord) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 });
  }

  if (classRecord.coach_id !== coachSession.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (classRecord.type !== 'WEEKLY') {
    return NextResponse.json({ error: 'Rubric Weekly only for WEEKLY classes' }, { status: 400 });
  }

  const template = await rubricsDao.findRubricTemplate('WEEKLY', classRecord.level_id);
  if (!template) {
    return NextResponse.json({ error: 'Rubric template not configured for this level' }, { status: 400 });
  }

  const allowedCharacters = new Set((template.positive_characters as string[]) ?? []);
  const filteredCharacters = positiveCharacters.filter((character) => allowedCharacters.has(character));

  const coder = await usersDao.getUserById(coderId);
  if (!coder) {
    return NextResponse.json({ error: 'Coder not found' }, { status: 404 });
  }

  const competencies = (template.competencies as unknown as CompetencyMap) ?? {};
  const gradePayload: Record<string, string> = Object.fromEntries(
    Object.entries(grades).map(([key, value]) => [key, value]),
  );

  const narrative = generateNarrative({
    coderName: coder.full_name,
    className: classRecord.name,
    competencies,
    grades: gradePayload,
    positiveCharacters: filteredCharacters,
  });

  const submission = await rubricsDao.submitRubric({
    classId,
    coderId,
    blockId,
    rubricTemplateId: template.id,
    grades: gradePayload,
    positiveCharacters: filteredCharacters,
    narrative,
    submittedBy: coachSession.user.id,
    status: 'FINAL',
  });

  return NextResponse.json({ submission });
}
