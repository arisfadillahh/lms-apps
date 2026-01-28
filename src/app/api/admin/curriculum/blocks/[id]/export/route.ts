import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
    try {
        const session = await getSessionOrThrow();
        await assertRole(session, 'ADMIN');

        const resolvedParams = await context.params;
        const blockId = resolvedParams.id;

        if (!blockId) {
            return new NextResponse('Block ID is required', { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Fetch lessons for the block
        const { data: lessons, error } = await supabase
            .from('lesson_templates')
            .select('title, summary, estimated_meeting_count, slide_url, make_up_instructions, order_index')
            .eq('block_id', blockId)
            .order('order_index', { ascending: true });

        if (error) {
            console.error('Export lessons error:', error);
            return new NextResponse('Failed to fetch lessons', { status: 500 });
        }

        if (!lessons || lessons.length === 0) {
            return new NextResponse('No lessons found in this block', { status: 404 });
        }

        // CSV Header
        const headers = ['title', 'summary', 'meetings', 'slide_url', 'makeup_instructions'];

        // CSV Rows
        const rows = lessons.map(lesson => {
            // Helper to escape CSV fields
            const escape = (field: string | number | null | undefined) => {
                if (field === null || field === undefined) return '';
                const stringField = String(field);
                if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                    return `"${stringField.replace(/"/g, '""')}"`;
                }
                return stringField;
            };

            return [
                escape(lesson.title),
                escape(lesson.summary),
                escape(lesson.estimated_meeting_count),
                escape(lesson.slide_url),
                escape(lesson.make_up_instructions)
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');

        // Return as CSV file
        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="lessons-block-${blockId}.csv"`,
            },
        });

    } catch (err) {
        console.error('Export error:', err);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
