import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const updateSchema = z.object({
    status: z.enum(['PENDING', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']),
});

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const { id } = await params;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Update the lesson report status
    const { data, error } = await (supabase as any)
        .from('lesson_reports')
        .update({
            status: parsed.data.status,
        })
        .eq('id', id)
        .select('*')
        .single();

    if (error) {
        console.error('[Lesson Report Update] Error:', error);
        return NextResponse.json({ error: 'Gagal mengupdate status' }, { status: 500 });
    }

    return NextResponse.json({ report: data });
}
