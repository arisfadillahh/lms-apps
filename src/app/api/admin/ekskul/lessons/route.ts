import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const createLessonSchema = z.object({
    planId: z.string().uuid(),
    title: z.string().min(1).max(300),
    summary: z.string().max(1000).nullable().optional(),
    slideUrl: z.string().url().nullable().optional().or(z.literal('')),
    exampleUrl: z.string().url().nullable().optional().or(z.literal('')),
    estimatedMeetings: z.number().int().min(1).optional(),
    orderIndex: z.number().int().min(1),
});

export async function POST(request: Request) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createLessonSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Shift existing lessons if inserting in the middle
    const { data: lessonsToShift } = await supabase
        .from('ekskul_lessons')
        .select('id, order_index')
        .eq('plan_id', parsed.data.planId)
        .gte('order_index', parsed.data.orderIndex)
        .order('order_index', { ascending: false });

    if (lessonsToShift && lessonsToShift.length > 0) {
        for (const les of lessonsToShift) {
            await supabase
                .from('ekskul_lessons')
                .update({ order_index: les.order_index + 1 })
                .eq('id', les.id);
        }
    }

    const { data, error } = await supabase
        .from('ekskul_lessons')
        .insert({
            plan_id: parsed.data.planId,
            title: parsed.data.title,
            summary: parsed.data.summary ?? null,
            slide_url: parsed.data.slideUrl || null,
            example_url: parsed.data.exampleUrl || null,
            estimated_meetings: parsed.data.estimatedMeetings ?? 1,
            order_index: parsed.data.orderIndex,
        })
        .select('*')
        .single();

    if (error) {
        console.error('[Create Ekskul Lesson] Error:', error);
        return NextResponse.json({ error: `Gagal menambah lesson: ${error.message}` }, { status: 500 });
    }

    // Update total_lessons count on the plan (ignore errors)
    try {
        const { count } = await supabase
            .from('ekskul_lessons')
            .select('*', { count: 'exact', head: true })
            .eq('plan_id', parsed.data.planId);

        if (count !== null) {
            await supabase
                .from('ekskul_lesson_plans')
                .update({ total_lessons: count })
                .eq('id', parsed.data.planId);
        }
    } catch {
        // Silently ignore count update errors
    }

    return NextResponse.json({ lesson: data }, { status: 201 });
}
