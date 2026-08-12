import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { serializeEkskulLessonSummary } from '@/lib/ekskulMakeUpInstructions';
import { assertRole } from '@/lib/roles';
import { reorderEkskulLesson, syncEkskulPlanAfterChange } from '@/lib/services/ekskulLessonPlanSync';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const lessonId = (await params).id;
    const planId = new URL(request.url).searchParams.get('planId');
    const supabase = getSupabaseAdmin();
    let query = supabase.from('ekskul_lessons').select('*').eq('id', lessonId);
    if (planId) query = query.eq('plan_id', planId);

    const { data, error } = await query.maybeSingle();
    if (error) return NextResponse.json({ error: `Gagal mengambil lesson: ${error.message}` }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Lesson tidak ditemukan di lesson plan ini' }, { status: 404 });

    return NextResponse.json({ lesson: data });
}

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

    const { data: currentLesson, error: lookupError } = await supabase
        .from('ekskul_lessons')
        .select('id, plan_id')
        .eq('id', lessonId)
        .maybeSingle();
    if (lookupError) return NextResponse.json({ error: `Gagal memvalidasi lesson: ${lookupError.message}` }, { status: 500 });
    if (!currentLesson) return NextResponse.json({ error: 'Lesson tidak ditemukan' }, { status: 404 });
    if (currentLesson.plan_id !== parsed.data.planId) {
        return NextResponse.json({ error: 'Lesson tidak termasuk dalam lesson plan yang dipilih' }, { status: 409 });
    }

    const payload = {
        title: parsed.data.title,
        summary: serializeEkskulLessonSummary(parsed.data.summary ?? null, parsed.data.makeUpInstructions ?? null),
        slide_url: parsed.data.slideUrl || null,
        estimated_meetings: parsed.data.estimatedMeetings ?? 1,
        order_index: parsed.data.orderIndex,
    };

    const { data, error } = await supabase
        .from('ekskul_lessons')
        .update(payload)
        .eq('id', lessonId)
        .select('*')
        .single();

    if (error) {
        console.error('[Update Ekskul Lesson] Error:', error);
        return NextResponse.json({ error: `Gagal update lesson: ${error.message}` }, { status: 500 });
    }

    await reorderEkskulLesson(parsed.data.planId, lessonId, parsed.data.orderIndex);
    await syncEkskulPlanAfterChange(parsed.data.planId);

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

    // Get plan_id before deleting so we can re-number and sync active ekskul classes.
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

    if (lesson?.plan_id) {
        await syncEkskulPlanAfterChange(lesson.plan_id);
    }

    return NextResponse.json({ success: true });
}
