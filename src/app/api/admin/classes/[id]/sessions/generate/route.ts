import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { sessionsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { generateSessionsSchema } from '@/lib/validation/admin';
import { autoAssignLessonsForClass } from '@/lib/services/lessonAutoAssign';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const resolvedParams = await context.params;
  const rawId = resolvedParams?.id ?? '';
  const classIdParam = decodeURIComponent(rawId).trim();

  if (!classIdParam || !isValidUuid(classIdParam)) {
    return NextResponse.json({ error: 'Invalid class id parameter' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = generateSessionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (start > end) {
    return NextResponse.json({ error: 'startDate must be before endDate' }, { status: 400 });
  }

  const sessions = await sessionsDao.generateSessions({
    classId: classIdParam,
    startDate: input.startDate,
    endDate: input.endDate,
    byDay: input.byDay,
    time: input.time,
    zoomLinkSnapshot: input.zoomLinkSnapshot ?? null,
  });

  let lessonsAssigned = 0;
  try {
    const result = await autoAssignLessonsForClass(classIdParam);
    lessonsAssigned = result.assigned;
  } catch (error) {
    console.error('[sessions/generate] Failed to auto-assign lessons to sessions', error);
  }

  return NextResponse.json({ sessions, lessonsAssigned }, { status: 201 });
}
