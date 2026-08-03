import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');
  const { id } = await context.params;
  const lessonId = decodeURIComponent(id ?? '').trim();

  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(lessonId)) {
    return NextResponse.json({ error: 'Invalid lesson id' }, { status: 400 });
  }

  try {
    const { restoreLessonSafely } = await import('@/lib/services/lessonArchive');
    const lesson = await restoreLessonSafely(lessonId);
    return NextResponse.json({ success: true, lesson });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to restore lesson';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
