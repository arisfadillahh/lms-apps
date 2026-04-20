import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

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
    const supabase = getSupabaseAdmin();

    const { data: targetSession, error: sessionError } = await supabase
      .from('sessions')
      .select('id, class_id, date_time')
      .eq('id', sessionId)
      .single();

    if (sessionError || !targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const classId = targetSession.class_id;

    const { data: validSessions, error: validSessionsError } = await supabase
      .from('sessions')
      .select('id, date_time')
      .eq('class_id', classId)
      .neq('status', 'CANCELLED')
      .order('date_time', { ascending: true });

    if (validSessionsError || !validSessions) {
      return NextResponse.json({ error: 'Failed to fetch valid sessions' }, { status: 500 });
    }

    const targetSessionRow = validSessions.find((sessionRow) => sessionRow.id === sessionId) ?? null;
    if (!targetSessionRow) {
      return NextResponse.json({ error: 'Cannot assign material to a cancelled or invalid session' }, { status: 400 });
    }

    const { data: movingLesson, error: movingLessonError } = await supabase
      .from('class_lessons')
      .select(`
        id,
        session_id,
        class_blocks!inner (
          class_id
        )
      `)
      .eq('id', classLessonId)
      .single();

    if (movingLessonError || !movingLesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    if ((movingLesson as any).class_blocks?.class_id !== classId) {
      return NextResponse.json({ error: 'Lesson not found in this class' }, { status: 404 });
    }

    const previousSessionId = (movingLesson as any).session_id as string | null;
    if (previousSessionId === sessionId) {
      return NextResponse.json({ success: true, preserved: true });
    }

    const { data: occupiedLesson, error: occupiedLessonError } = await supabase
      .from('class_lessons')
      .select('id, session_id')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (occupiedLessonError) {
      return NextResponse.json({ error: 'Failed to inspect current assignment' }, { status: 500 });
    }

    const previousSession = previousSessionId
      ? validSessions.find((sessionRow) => sessionRow.id === previousSessionId) ?? null
      : null;

    if (!previousSessionId && occupiedLesson && occupiedLesson.id !== classLessonId) {
      return NextResponse.json(
        {
          error: 'Cannot move an unscheduled lesson into an occupied session. Choose an empty session or auto-assign first.',
        },
        { status: 400 },
      );
    }

    const originalAssignments = [
      {
        lessonId: classLessonId,
        sessionId: previousSessionId,
        unlockAt: previousSession?.date_time ?? null,
      },
      ...(occupiedLesson && occupiedLesson.id !== classLessonId
        ? [{
            lessonId: occupiedLesson.id as string,
            sessionId: (occupiedLesson as any).session_id as string | null,
            unlockAt: targetSessionRow.date_time,
          }]
        : []),
    ];

    try {
      const { error: clearMovingError } = await supabase
        .from('class_lessons')
        .update({ session_id: null, unlock_at: null })
        .eq('id', classLessonId);

      if (clearMovingError) {
        throw clearMovingError;
      }

      if (occupiedLesson && occupiedLesson.id !== classLessonId) {
        const { error: clearOccupiedError } = await supabase
          .from('class_lessons')
          .update({ session_id: null, unlock_at: null })
          .eq('id', occupiedLesson.id);

        if (clearOccupiedError) {
          throw clearOccupiedError;
        }
      }

      const { error: assignMovingError } = await supabase
        .from('class_lessons')
        .update({
          session_id: targetSessionRow.id,
          unlock_at: targetSessionRow.date_time,
        })
        .eq('id', classLessonId);

      if (assignMovingError) {
        throw assignMovingError;
      }

      if (occupiedLesson && occupiedLesson.id !== classLessonId && previousSessionId && previousSession) {
        const { error: restoreOccupiedError } = await supabase
          .from('class_lessons')
          .update({
            session_id: previousSession.id,
            unlock_at: previousSession.date_time,
          })
          .eq('id', occupiedLesson.id);

        if (restoreOccupiedError) {
          throw restoreOccupiedError;
        }
      }
    } catch (swapError) {
      console.error('[MaterialShift] Failed local swap, attempting rollback:', swapError);

      for (const assignment of originalAssignments) {
        const { error: rollbackError } = await supabase
          .from('class_lessons')
          .update({
            session_id: assignment.sessionId,
            unlock_at: assignment.unlockAt,
          })
          .eq('id', assignment.lessonId);

        if (rollbackError) {
          console.error('[MaterialShift] Rollback failed for lesson:', assignment.lessonId, rollbackError);
        }
      }

      return NextResponse.json({ error: 'Failed to shift material' }, { status: 500 });
    }

    try {
      const { syncBlockStatusesForClass } = await import('@/lib/services/lessonAutoAssign');
      await syncBlockStatusesForClass(classId);
    } catch (err) {
      console.error('[MaterialShift] Failed to sync block statuses:', err);
    }

    revalidatePath('/admin/classes/[id]', 'page');
    revalidatePath('/admin/classes');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error shifting material:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
