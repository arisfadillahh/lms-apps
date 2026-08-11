import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionOrThrow } from '@/lib/auth';
import { serializeEkskulLessonSummary } from '@/lib/ekskulMakeUpInstructions';
import { assertRole } from '@/lib/roles';
import { syncEkskulPlanAfterChange } from '@/lib/services/ekskulLessonPlanSync';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const bulkUpdateSchema = z.object({
    updates: z.array(z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(300),
        summary: z.string().nullable().optional(),
        slideUrl: z.string().url().nullable().optional().or(z.literal('')),
        makeUpInstructions: z.string().max(2000).nullable().optional(),
        estimatedMeetings: z.number().int().min(0),
        orderIndex: z.number().int().min(1),
    })),
});

export async function POST(request: Request) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const parsed = bulkUpdateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const errors: string[] = [];

    for (const update of parsed.data.updates) {
        const payload = {
            title: update.title,
            summary: serializeEkskulLessonSummary(update.summary ?? null, update.makeUpInstructions ?? null),
            slide_url: update.slideUrl || null,
            estimated_meetings: update.estimatedMeetings,
            order_index: update.orderIndex,
        };

        const { error } = await supabase
            .from('ekskul_lessons')
            .update(payload)
            .eq('id', update.id);

        if (error) errors.push(`${update.title}: ${error.message}`);
    }

    if (errors.length > 0) {
        return NextResponse.json({ error: 'Beberapa lesson gagal diupdate', details: errors }, { status: 207 });
    }

    if (parsed.data.updates.length > 0) {
        const { data: lesson, error } = await supabase
            .from('ekskul_lessons')
            .select('plan_id')
            .eq('id', parsed.data.updates[0].id)
            .single();

        if (error) {
            return NextResponse.json({ error: `Gagal sync lesson plan: ${error.message}` }, { status: 500 });
        }

        if (lesson?.plan_id) {
            await syncEkskulPlanAfterChange(lesson.plan_id);
        }
    }

    return NextResponse.json({ success: true, updated: parsed.data.updates.length });
}
