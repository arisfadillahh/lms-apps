import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { autoAssignLessonsForClass } from '@/lib/services/lessonAutoAssign';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isValidUuid(value: string): boolean {
  // UUIDv4 pattern: 8-4-4-4-12 hex chars, with version/variant bits enforced
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const resolvedParams = await context.params;
  const rawId = resolvedParams?.id ?? '';
  const classId = decodeURIComponent(rawId).trim();

  if (!classId || !isValidUuid(classId)) {
    return NextResponse.json({ error: 'Invalid class id parameter' }, { status: 400 });
  }

  try {
    const result = await autoAssignLessonsForClass(classId);
    return NextResponse.json({ lessonsAssigned: result.assigned });
  } catch (error) {
    console.error('[lessons/auto-assign] Failed to auto-assign lessons', error);
    return NextResponse.json({ error: 'Failed to auto-assign lessons' }, { status: 500 });
  }
}
