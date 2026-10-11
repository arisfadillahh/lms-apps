import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const updateSchema = z.object({
    status: z.enum(['PENDING', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']).optional(),
    reportType: z.enum(['TOO_DIFFICULT', 'UNCLEAR', 'BUG', 'OUTDATED', 'OTHER']).optional(),
    description: z.string().trim().min(3).max(1000).optional(),
}).refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field is required',
});

const EKSKUL_LESSON_MARKER = /^\[Ekskul lesson: [^\]]+\]\s*/;

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

    const updates: Record<string, string> = {};
    if (parsed.data.status) updates.status = parsed.data.status;
    if (parsed.data.reportType) updates.report_type = parsed.data.reportType;

    if (parsed.data.description) {
        const { data: currentReport, error: currentError } = await (supabase as any)
            .from('lesson_reports')
            .select('description')
            .eq('id', id)
            .maybeSingle();

        if (currentError) {
            console.error('[Lesson Report Update] Read error:', currentError);
            return NextResponse.json({ error: 'Gagal membaca laporan' }, { status: 500 });
        }
        if (!currentReport) {
            return NextResponse.json({ error: 'Laporan tidak ditemukan' }, { status: 404 });
        }

        const marker = currentReport.description?.match(EKSKUL_LESSON_MARKER)?.[0] ?? '';
        updates.description = `${marker}${parsed.data.description}`;
    }

    const { data, error } = await (supabase as any)
        .from('lesson_reports')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

    if (error) {
        console.error('[Lesson Report Update] Error:', error);
        return NextResponse.json({ error: 'Gagal memperbarui laporan' }, { status: 500 });
    }

    return NextResponse.json({ report: data });
}
