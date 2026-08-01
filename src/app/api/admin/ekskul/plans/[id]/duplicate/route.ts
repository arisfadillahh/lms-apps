import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { serializeEkskulLessonSummary, splitEkskulLessonMakeUp } from '@/lib/ekskulMakeUpInstructions';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const { id: planId } = await params;
    const supabase = getSupabaseAdmin();

    // Fetch source plan
    const { data: sourcePlan, error: planError } = await supabase
        .from('ekskul_lesson_plans')
        .select('*')
        .eq('id', planId)
        .single();

    if (planError || !sourcePlan) {
        return NextResponse.json({ error: 'Plan tidak ditemukan' }, { status: 404 });
    }

    // Create duplicate plan
    const { data: newPlan, error: createError } = await supabase
        .from('ekskul_lesson_plans')
        .insert({
            name: `Copy of ${sourcePlan.name}`,
            description: sourcePlan.description,
            is_active: false, // Start as inactive
            total_lessons: sourcePlan.total_lessons,
        })
        .select('*')
        .single();

    if (createError || !newPlan) {
        return NextResponse.json({ error: `Gagal menduplikat plan: ${createError?.message}` }, { status: 500 });
    }

    // Fetch source lessons
    const { data: sourceLessons } = await supabase
        .from('ekskul_lessons')
        .select('*')
        .eq('plan_id', planId)
        .order('order_index', { ascending: true });

    // Duplicate lessons
    if (sourceLessons && sourceLessons.length > 0) {
        const newLessons = sourceLessons.map((l: any) => ({
            plan_id: newPlan.id,
            title: l.title,
            summary: splitEkskulLessonMakeUp(l.summary, l.make_up_instructions).summary,
            slide_url: l.slide_url,
            example_url: l.example_url,
            make_up_instructions: splitEkskulLessonMakeUp(l.summary, l.make_up_instructions).makeUpInstructions,
            estimated_meetings: l.estimated_meetings,
            order_index: l.order_index,
        }));

        const { error: insertLessonsError } = await supabase.from('ekskul_lessons').insert(newLessons);
        if (isMissingMakeUpColumnError(insertLessonsError)) {
            const fallbackLessons = sourceLessons.map((l: any) => {
                const parts = splitEkskulLessonMakeUp(l.summary, l.make_up_instructions);
                return {
                    plan_id: newPlan.id,
                    title: l.title,
                    summary: serializeEkskulLessonSummary(parts.summary, parts.makeUpInstructions),
                    slide_url: l.slide_url,
                    example_url: l.example_url,
                    estimated_meetings: l.estimated_meetings,
                    order_index: l.order_index,
                };
            });
            await supabase.from('ekskul_lessons').insert(fallbackLessons);
        }
    }

    // Copy software assignments
    const { data: planSoftware } = await supabase
        .from('ekskul_plan_software')
        .select('software_id')
        .eq('plan_id', planId);

    if (planSoftware && planSoftware.length > 0) {
        await supabase.from('ekskul_plan_software').insert(
            planSoftware.map((ps: any) => ({ plan_id: newPlan.id, software_id: ps.software_id }))
        );
    }

    return NextResponse.json({ plan: newPlan }, { status: 201 });
}

function isMissingMakeUpColumnError(error: unknown) {
    return Boolean(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === '42703'
    );
}
