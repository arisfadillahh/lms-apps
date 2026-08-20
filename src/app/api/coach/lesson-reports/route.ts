import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { createAdminNotifications } from '@/lib/dao/notificationsDao';
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
    lessonSource: z.enum(['WEEKLY', 'EKSKUL']).default('WEEKLY'),
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
    let lessonTitle = 'Unknown lesson';
    let lessonTemplateId: string | null = parsed.data.lessonTemplateId;

    if (parsed.data.lessonSource === 'EKSKUL') {
        const { data: ekskulLesson } = await supabase
            .from('ekskul_lessons')
            .select('title')
            .eq('id', parsed.data.lessonTemplateId)
            .maybeSingle();

        if (!ekskulLesson) {
            return NextResponse.json({ error: 'Lesson Ekskul tidak ditemukan' }, { status: 404 });
        }

        lessonTitle = ekskulLesson.title;
        lessonTemplateId = null;
    } else {
        const { data: lessonTemplate } = await supabase
            .from('lesson_templates')
            .select('title')
            .eq('id', parsed.data.lessonTemplateId)
            .maybeSingle();

        if (!lessonTemplate) {
            return NextResponse.json({ error: 'Lesson tidak ditemukan' }, { status: 404 });
        }

        lessonTitle = lessonTemplate.title;
    }

    const persistedDescription = parsed.data.lessonSource === 'EKSKUL'
        ? `[Ekskul lesson: ${lessonTitle}]\n\n${parsed.data.description}`
        : parsed.data.description;

    const { data, error } = await (supabase as any)
        .from('lesson_reports')
        .insert({
            lesson_template_id: lessonTemplateId,
            coach_id: session.user.id,
            report_type: parsed.data.reportType,
            description: persistedDescription,
            status: 'PENDING',
        })
        .select('*')
        .single();

    if (error) {
        console.error('[Lesson Report] Error:', error);
        return NextResponse.json({
            error: 'Gagal menyimpan laporan. Pastikan tabel lesson_reports sudah ada.',
            details: error.message,
        }, { status: 500 });
    }

    const coachName = session.user.fullName || 'Coach';
    const reportTypeLabel = REPORT_TYPE_LABELS[parsed.data.reportType] || parsed.data.reportType;

    try {
        await createAdminNotifications({
            type: 'LESSON_REPORT',
            title: 'Laporan masalah lesson',
            message: `${coachName} melaporkan masalah "${reportTypeLabel}" pada lesson "${lessonTitle}". Catatan: ${parsed.data.description}`,
            pushUrl: '/admin/curriculum/reports',
            pushTag: `lesson-report-${data.id}`,
        });
    } catch (notificationError) {
        console.error('[Lesson Report] Notification error:', notificationError);
    }

    return NextResponse.json({ report: data }, { status: 201 });
}
