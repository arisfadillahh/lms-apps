import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { splitEkskulLessonMakeUp } from '@/lib/ekskulMakeUpInstructions';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: RouteContext) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const { id: planId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: plan } = await supabase
        .from('ekskul_lesson_plans')
        .select('name')
        .eq('id', planId)
        .single();

    const { data: lessons, error } = await supabase
        .from('ekskul_lessons')
        .select('*')
        .eq('plan_id', planId)
        .order('order_index', { ascending: true });

    if (error) {
        return NextResponse.json({ error: 'Gagal mengambil lessons' }, { status: 500 });
    }

    // Build CSV. Keep the public header aligned with weekly lesson import/export.
    const header = 'title,summary,meetings,slide_url,example_url,makeup_instructions';
    const rows = (lessons || []).map((l: any) => {
        const parts = splitEkskulLessonMakeUp(l.summary, l.make_up_instructions);
        const escape = (v: string | null | undefined) => {
            if (!v) return '';
            return `"${String(v).replace(/"/g, '""')}"`;
        };
        return [
            escape(l.title),
            escape(parts.summary),
            l.estimated_meetings ?? 1,
            escape(l.slide_url),
            escape(l.example_url),
            escape(parts.makeUpInstructions),
        ].join(',');
    });

    const csv = [header, ...rows].join('\n');
    const planName = plan?.name?.replace(/[^a-z0-9]/gi, '-') || planId.slice(0, 8);

    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="ekskul-${planName}.csv"`,
        },
    });
}
