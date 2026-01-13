import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const reportSchema = z.object({
    lessonTemplateId: z.string().uuid(),
    reportType: z.enum(['TOO_DIFFICULT', 'UNCLEAR', 'BUG', 'OUTDATED', 'OTHER']),
    description: z.string().min(10).max(1000),
});

export async function POST(request: Request) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'COACH');

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Insert the lesson report (cast to any since table may not be in generated types)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from('lesson_reports')
        .insert({
            lesson_template_id: parsed.data.lessonTemplateId,
            coach_id: session.user.id,
            report_type: parsed.data.reportType,
            description: parsed.data.description,
            status: 'PENDING',
        })
        .select('*')
        .single();

    if (error) {
        console.error('[Lesson Report] Error:', error);
        return NextResponse.json({ error: 'Gagal menyimpan laporan' }, { status: 500 });
    }

    // Create notification for admins
    const { data: admins } = await supabase.from('users').select('id').eq('role', 'ADMIN');

    if (admins && admins.length > 0) {
        const notifications = admins.map((admin) => ({
            user_id: admin.id,
            type: 'LESSON_REPORT',
            title: 'Laporan Masalah Lesson',
            message: `Coach melaporkan masalah pada lesson: ${parsed.data.reportType}`,
            metadata: JSON.stringify({ reportId: data?.id, lessonTemplateId: parsed.data.lessonTemplateId }),
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert(notifications);
    }

    return NextResponse.json({ report: data }, { status: 201 });
}
