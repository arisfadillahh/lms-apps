import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { reassignLessonsToSessions } from '@/lib/services/lessonRebalancer';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';

export async function GET() {
    try {
        const session = await getSessionOrThrow();
        await assertRole(session, 'ADMIN');
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: classes, error } = await supabase
        .from('classes')
        .select('id');
        
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
