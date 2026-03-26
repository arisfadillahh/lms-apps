import { NextResponse } from 'next/server';
import { autoCompletePastSessions, ensureFutureSessions } from '@/lib/dao/sessionsDao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { verifyCronRequest } from '@/lib/cron';

export const dynamic = 'force-dynamic';


/**
 * Cron endpoint to auto-complete past sessions AND ensure rolling 12-week schedule.
 * Call this endpoint periodically (e.g., every hour) to:
 * 1. Mark expired sessions as COMPLETED
 * 2. Ensure the next 12 weeks of sessions are generated for affected classes
 *
 * Example cron setup (Vercel):
 * {
 *   "crons": [{
 *     "path": "/api/cron/session-complete",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */
export async function GET(request: Request) {
    if (!verifyCronRequest(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }


    try {
        console.log('[Cron] Running session auto-complete job');

        const result = await autoCompletePastSessions();

        // After completing sessions, ensure rolling 12-week schedule for affected classes
        if (result.updated > 0 && result.sessionIds.length > 0) {
            const supabase = getSupabaseAdmin();

            // Get unique class IDs from the completed sessions
            const { data: completedSessions } = await supabase
                .from('sessions')
                .select('class_id')
                .in('id', result.sessionIds);

            if (completedSessions) {
                const uniqueClassIds = [...new Set(completedSessions.map(s => s.class_id))];
                console.log(`[Cron] Ensuring 12-week schedule for ${uniqueClassIds.length} classes`);

                for (const classId of uniqueClassIds) {
                    await ensureFutureSessions(classId);
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Auto-completed ${result.updated} sessions`,
            updated: result.updated,
            sessionIds: result.sessionIds
        });
    } catch (error) {
        console.error('[Cron] Session auto-complete error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
