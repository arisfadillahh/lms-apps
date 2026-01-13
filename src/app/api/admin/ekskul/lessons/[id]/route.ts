import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const updateLessonSchema = z.object({
    planId: z.string().uuid(),
    title: z.string().min(1).max(300),
    summary: z.string().max(1000).nullable().optional(),
    slideUrl: z.string().url().nullable().optional().or(z.literal('')),
    estimatedMeetings: z.number().int().min(1).optional(),
    orderIndex: z.number().int().min(1),
});

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const resolvedParams = await params;
    const lessonId = resolvedParams.id;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateLessonSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check if order changed
    const currentLesson = await supabase.from('ekskul_lessons').select('order_index').eq('id', lessonId).single();

    if (currentLesson.data && currentLesson.data.order_index !== parsed.data.orderIndex) {
        // Simple shift logic: if moving to N, shift everything >= N (excluding self) to N+1
        // (Same simple logic as create, might need more robust swapping for reordering, but basic shift ensures no collision on insert-like move)
        // A better approach for exact re-ordering is usually complex.
        // For now, let's just allow duplicate order indices or simple shift.
        // Let's replicate "insert" shift logic for the target index.

        const { data: lessonsToShift } = await supabase
            .from('ekskul_lessons')
            .select('id, order_index')
            .eq('plan_id', parsed.data.planId)
            .gte('order_index', parsed.data.orderIndex)
            .neq('id', lessonId) // Don't shift self
            .order('order_index', { ascending: false });

        if (lessonsToShift && lessonsToShift.length > 0) {
            for (const les of lessonsToShift) {
                await supabase
                    .from('ekskul_lessons')
                    .update({ order_index: les.order_index + 1 })
                    .eq('id', les.id);
            }
        }
    }

    const { data, error } = await supabase
        .from('ekskul_lessons')
        .update({
            title: parsed.data.title,
            summary: parsed.data.summary ?? null,
            slide_url: parsed.data.slideUrl || null,
            estimated_meetings: parsed.data.estimatedMeetings ?? 1,
            order_index: parsed.data.orderIndex,
        })
        .eq('id', lessonId)
        .select('*')
        .single();

    if (error) {
        console.error('[Update Ekskul Lesson] Error:', error);
        return NextResponse.json({ error: `Gagal update lesson: ${error.message}` }, { status: 500 });
    }

    // Update plan total count/meetings if needed (optional)

    return NextResponse.json({ lesson: data });
}
