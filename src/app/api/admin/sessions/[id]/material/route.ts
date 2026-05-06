import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { reflowLessonsFromSession } from '@/lib/services/lessonAutoAssign';

type RouteParams = { id: string };
type RouteContext = { params: RouteParams | Promise<RouteParams> };

const assignMaterialSchema = z.object({
  classLessonId: z.string().uuid(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, ['ADMIN']);

    const params = await context.params;
    const sessionId = params.id;

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session id' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = assignMaterialSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { classLessonId } = parsed.data;
    const result = await reflowLessonsFromSession(sessionId, classLessonId);

    revalidatePath('/admin/classes/[id]', 'page');
    revalidatePath('/admin/classes');

    return NextResponse.json({ success: true, assigned: result.assigned });
  } catch (error: unknown) {
    console.error('Error shifting material:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 },
    );
  }
}
