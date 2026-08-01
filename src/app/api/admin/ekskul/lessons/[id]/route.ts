import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { serializeEkskulLessonSummary } from '@/lib/ekskulMakeUpInstructions';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const updateLessonSchema = z.object({
    planId: z.string().uuid(),
    title: z.string().min(1).max(300),
    summary: z.string().max(1000).nullable().optional(),
    slideUrl: z.string().url().nullable().optional().or(z.literal('')),
    makeUpInstructions: z.string().max(2000).nullable().optional(),
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

    const basePayload = {
        title: parsed.data.title,
        summary: parsed.data.summary ?? null,
        slide_url: parsed.data.slideUrl || null,
        estimated_meetings: parsed.data.estimatedMeetings ?? 1,
        order_index: parsed.data.orderIndex,
    };
    const payloadWithMakeUpColumn = {
        ...basePayload,
        make_up_instructions: parsed.data.makeUpInstructions ?? null,
    };

    let { data, error } = await supabase
        .from('ekskul_lessons')
        .update(payloadWithMakeUpColumn)
        .eq('id', lessonId)
        .select('*')
        .single();

    if (isMissingMakeUpColumnError(error)) {
        const fallbackPayload = {
            ...basePayload,
            summary: serializeEkskulLessonSummary(parsed.data.summary ?? null, parsed.data.makeUpInstructions ?? null),
        };
        const fallbackResult = await supabase
            .from('ekskul_lessons')
            .update(fallbackPayload)
            .eq('id', lessonId)
            .select('*')
            .single();
        data = fallbackResult.data;
        error = fallbackResult.error;
    }

    if (error) {
        console.error('[Update Ekskul Lesson] Error:', error);
        return NextResponse.json({ error: `Gagal update lesson: ${error.message}` }, { status: 500 });
    }

    // Update plan total count/meetings if needed (optional)

    return NextResponse.json({ lesson: data });
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const resolvedParams = await params;
    const lessonId = resolvedParams.id;

    const supabase = getSupabaseAdmin();

    // Get plan_id before deleting (for total_lessons update)
    const { data: lesson } = await supabase
        .from('ekskul_lessons')
        .select('plan_id')
        .eq('id', lessonId)
        .single();

    const { error } = await supabase
        .from('ekskul_lessons')
        .delete()
        .eq('id', lessonId);

    if (error) {
        return NextResponse.json({ error: `Gagal menghapus lesson: ${error.message}` }, { status: 500 });
    }

    // Update total_lessons count
    if (lesson?.plan_id) {
        const { count } = await supabase
            .from('ekskul_lessons')
            .select('*', { count: 'exact', head: true })
            .eq('plan_id', lesson.plan_id);
        if (count !== null) {
            await supabase.from('ekskul_lesson_plans').update({ total_lessons: count }).eq('id', lesson.plan_id);
        }
    }

    return NextResponse.json({ success: true });
}

function isMissingMakeUpColumnError(error: unknown) {
    return Boolean(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === '42703'
    );
}
