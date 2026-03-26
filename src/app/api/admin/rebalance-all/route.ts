import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { reassignLessonsToSessions } from '@/lib/services/lessonRebalancer';

export async function GET() {
    const supabase = getSupabaseAdmin();
    // Fetch all active classes
    const { data: classes, error } = await supabase
        .from('classes')
        .select('id')
        .eq('status', 'ACTIVE');
        
    if (error || !classes) {
        return NextResponse.json({ error: error?.message || 'Failed to fetch classes' });
    }

    const results = [];
    for (const cls of classes) {
        try {
            await reassignLessonsToSessions(cls.id);
            results.push({ classId: cls.id, status: 'success' });
        } catch (err: any) {
            results.push({ classId: cls.id, status: 'error', message: err.message });
        }
    }

    return NextResponse.json({ total: classes.length, results });
}
