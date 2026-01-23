import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const REPORT_TYPE_LABELS: Record<string, string> = {
    TOO_DIFFICULT: 'Terlalu Sulit',
    UNCLEAR: 'Materi Kurang Jelas',
    BUG: 'Ada Bug/Error',
    OUTDATED: 'Materi Tidak Relevan',
    OTHER: 'Lainnya',
};

const reportSchema = z.object({
    lessonTemplateId: z.string().uuid(),
    reportType: z.enum(['TOO_DIFFICULT', 'UNCLEAR', 'BUG', 'OUTDATED', 'OTHER']),
    description: z.string().min(3).max(1000),
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

    // Get lesson title for better notification
    const { data: lessonTemplate } = await supabase
        .from('lesson_templates')
        .select('title')
        .eq('id', parsed.data.lessonTemplateId)
        .single();

    const lessonTitle = lessonTemplate?.title || 'Unknown lesson';

    // Insert the lesson report
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
        return NextResponse.json({
            error: 'Gagal menyimpan laporan. Pastikan tabel lesson_reports sudah ada.',
            details: error.message
        }, { status: 500 });
    }

    // Create notification for all admins
    const { data: admins } = await supabase.from('users').select('id').eq('role', 'ADMIN');
    const coachName = session.user.fullName || 'Coach';
    const reportTypeLabel = REPORT_TYPE_LABELS[parsed.data.reportType] || parsed.data.reportType;

    if (admins && admins.length > 0) {
        const notifications = admins.map((admin) => ({
            user_id: admin.id,
            type: 'LESSON_REPORT',
            title: '📋 Laporan Masalah Lesson',
            message: `${coachName} melaporkan masalah "${reportTypeLabel}" pada lesson "${lessonTitle}"`,
            is_read: false,
        }));

        const { error: notifError } = await (supabase as any).from('notifications').insert(notifications);
        if (notifError) {
            console.error('[Lesson Report] Notification error:', notifError);
        }
    }

    return NextResponse.json({ report: data }, { status: 201 });
}

