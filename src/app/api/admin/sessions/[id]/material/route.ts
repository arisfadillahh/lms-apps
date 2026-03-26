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

    // 1. Get the target session to find its class_id
    const { data: targetSession, error: sessionError } = await supabase
      .from('sessions')
      .select('id, class_id, date_time')
      .eq('id', sessionId)
      .single();

    if (sessionError || !targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const classId = targetSession.class_id;

    // 2. Fetch all valid sessions for this class (with date_time for unlock_at)
    const { data: validSessions, error: validSessionsError } = await supabase
      .from('sessions')
      .select('id, date_time')
      .eq('class_id', classId)
      .neq('status', 'CANCELLED')
      .order('date_time', { ascending: true });

    if (validSessionsError || !validSessions) {
      return NextResponse.json({ error: 'Failed to fetch valid sessions' }, { status: 500 });
    }

    const targetSessionIndex = validSessions.findIndex((s) => s.id === sessionId);
    if (targetSessionIndex === -1) {
      return NextResponse.json({ error: 'Cannot assign material to a cancelled or invalid session' }, { status: 400 });
    }

    // 3. Fetch ALL class_lessons for this class, ordered by curriculum sequence
    const { data: lessons, error: lessonError } = await supabase
      .from('class_lessons')
      .select(`
        id, 
        order_index, 
        class_block_id,
        class_blocks!inner (
          id,
          class_id,
          blocks ( order_index )
        )
      `)
      .eq('class_blocks.class_id', classId);

    if (lessonError || !lessons) {
      return NextResponse.json({ error: 'Failed to fetch class lessons' }, { status: 500 });
    }

    // Sort to get current global curriculum sequence
    const sortedLessons = (lessons as any[]).sort((a, b) => {
      const blockOrderA = a.class_blocks?.blocks?.order_index ?? 0;
      const blockOrderB = b.class_blocks?.blocks?.order_index ?? 0;
      if (blockOrderA !== blockOrderB) return blockOrderA - blockOrderB;
      if (a.order_index !== b.order_index) return a.order_index - b.order_index;
      return a.id.localeCompare(b.id);
    });

    // 4. Find the lesson to move
    const lessonToMoveIndex = sortedLessons.findIndex((l: any) => l.id === classLessonId);
    if (lessonToMoveIndex === -1) {
      return NextResponse.json({ error: 'Lesson not found in this class' }, { status: 404 });
    }
    const lessonToMove = sortedLessons[lessonToMoveIndex];

    // 5. Compute the OFFSET so that lesson[lessonToMoveIndex] aligns with session[targetSessionIndex].
    // This shifts the ENTIRE lesson sequence, adjusting BOTH previous AND next sessions automatically.
    // e.g. if Part 5 (lessonToMoveIndex=7) is assigned to session 2 (targetSessionIndex=2),
    //      offset = 2 - 7 = -5, so Part 4 → session 1, Part 3 → session 0, Part 6 → session 3, etc.
    const sessionOffset = targetSessionIndex - lessonToMoveIndex;

    const lessonIds = sortedLessons.map((l: any) => l.id);

    // Phase A: Clear ALL session_ids first to avoid UNIQUE constraint conflicts
    const { error: clearError } = await supabase
      .from('class_lessons')
      .update({ session_id: null, unlock_at: null })
      .in('id', lessonIds);

    if (clearError) {
      console.error('[MaterialShift] Failed to clear session ids:', clearError);
      return NextResponse.json({ error: 'Failed to shift material' }, { status: 500 });
    }

    // Phase B: Assign sessions sequentially with the offset
    console.log(`[MaterialShift] Anchoring lesson at index ${lessonToMoveIndex} to session index ${targetSessionIndex} (offset=${sessionOffset})`);
    for (let i = 0; i < sortedLessons.length; i++) {
      const sessionIndex = i + sessionOffset;
      const sess = (sessionIndex >= 0 && sessionIndex < validSessions.length)
        ? validSessions[sessionIndex]
        : null;

      const { error: assignError } = await supabase
        .from('class_lessons')
        .update({
          session_id: sess?.id ?? null,
          unlock_at: sess?.date_time ?? null,
        })
        .eq('id', sortedLessons[i].id);

      if (assignError) {
        console.error(`[MaterialShift] Failed to assign session for lesson ${sortedLessons[i].id}:`, assignError);
      }
    }

    revalidatePath('/admin/classes/[id]', 'page');
    revalidatePath('/admin/classes');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error shifting material:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
