import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionOrThrow } from '@/lib/auth';
import { serializeEkskulLessonSummary } from '@/lib/ekskulMakeUpInstructions';
import { assertRole } from '@/lib/roles';
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
        const basePayload = {
            title: update.title,
            summary: update.summary ?? null,
            slide_url: update.slideUrl || null,
            estimated_meetings: update.estimatedMeetings,
            order_index: update.orderIndex,
        };
        const payloadWithMakeUpColumn = {
            ...basePayload,
            make_up_instructions: update.makeUpInstructions ?? null,
        };

        let { error } = await supabase
            .from('ekskul_lessons')
            .update(payloadWithMakeUpColumn)
            .eq('id', update.id);

        if (isMissingMakeUpColumnError(error)) {
            const fallbackPayload = {
                ...basePayload,
                summary: serializeEkskulLessonSummary(update.summary ?? null, update.makeUpInstructions ?? null),
            };
            const fallbackResult = await supabase
                .from('ekskul_lessons')
                .update(fallbackPayload)
                .eq('id', update.id);
            error = fallbackResult.error;
        }

        if (error) errors.push(`${update.title}: ${error.message}`);
    }

    if (errors.length > 0) {
        return NextResponse.json({ error: 'Beberapa lesson gagal diupdate', details: errors }, { status: 207 });
    }

    return NextResponse.json({ success: true, updated: parsed.data.updates.length });
}

function isMissingMakeUpColumnError(error: unknown) {
    return Boolean(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === '42703'
    );
}
