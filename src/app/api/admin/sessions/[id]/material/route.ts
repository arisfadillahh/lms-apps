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

    // 1. Get the target session to find its class_id and chronological position
    const { data: targetSession, error: sessionError } = await supabase
      .from('sessions')
      .select('id, class_id, date_time')
      .eq('id', sessionId)
      .single();

    if (sessionError || !targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const classId = targetSession.class_id;

    // 2. Fetch all valid sessions for this class to determine the target index
    const { data: validSessions, error: validSessionsError } = await supabase
      .from('sessions')
      .select('id')
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

    // 3. Fetch all class_lessons for this class, ordered natively
    const { data: lessons, error: lessonError } = await supabase
      .from('class_lessons')
      .select(`
        id, 
        order_index, 
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

    // Sort to get current sequence
    const sortedLessons = lessons.sort((a: any, b: any) => {
      const blockOrderA = a.class_blocks?.blocks?.order_index ?? 0;
      const blockOrderB = b.class_blocks?.blocks?.order_index ?? 0;
      if (blockOrderA !== blockOrderB) return blockOrderA - blockOrderB;
      if (a.order_index !== b.order_index) return a.order_index - b.order_index;
      return a.id.localeCompare(b.id);
    });

    // 4. Find the lesson we want to insert
    const lessonToMoveIndex = sortedLessons.findIndex((l) => l.id === classLessonId);
    if (lessonToMoveIndex === -1) {
      return NextResponse.json({ error: 'Lesson not found in this class' }, { status: 404 });
    }

    const lessonToMove = sortedLessons[lessonToMoveIndex];

    // Splice it out of its current position
    sortedLessons.splice(lessonToMoveIndex, 1);

    // Insert it exactly at the target index (which corresponds to the session's index)
    // If target index is beyond the length, just push it
    const insertIndex = Math.min(targetSessionIndex, sortedLessons.length);
    sortedLessons.splice(insertIndex, 0, lessonToMove);

    // 5. Build bulk update for order_index
    // We update the order_index sequentially for the new array so the rebalancer natively reads it properly.
    // Base the new order on indices (e.g. 1000, 2000, 3000 to keep it clean, or just 10, 20, 30... wait, class_blocks logic expects order_index).
    // Actually, just linearly resetting order_index across the whole class is risky if there are blocks.
    // Instead, we just assign the current array elements a sequence from 0 to N.
    // Wait; blocks have their own order_index. If we shift a lesson across blocks, we technically change its block? 
    // We shouldn't change its class_block_id to avoid breaking logic, just its order_index.
    
    const updatePromises = [];
    for (let i = 0; i < sortedLessons.length; i++) {
        // Just enforce strict sequential order within the global map
        const newOrder = i * 1000;
        updatePromises.push(
            supabase.from('class_lessons')
              .update({ order_index: newOrder })
              .eq('id', sortedLessons[i].id)
        );
    }

    await Promise.all(updatePromises);

    // 6. Run Rebalancer automatically!
    const { reassignLessonsToSessions } = await import('@/lib/services/lessonRebalancer');
    await reassignLessonsToSessions(classId);

    revalidatePath('/admin/classes/[id]', 'page');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error shifting material:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
