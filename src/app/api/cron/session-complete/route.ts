import { NextResponse } from 'next/server';
import { autoCompletePastSessions } from '@/lib/dao/sessionsDao';

export const dynamic = 'force-dynamic';

/**
 * Cron endpoint to auto-complete past sessions.
 * Call this endpoint periodically (e.g., every hour) to mark expired sessions as COMPLETED.
 * 
 * Example cron setup (Vercel):
 * {
 *   "crons": [{
 *     "path": "/api/cron/session-complete",
 *     "schedule": "0 * * * *"  // Every hour
 *   }]
 * }
 */
export async function GET(request: Request) {
    try {
        // Optional: Check for Authorization header if you want to secure it
        // const authHeader = request.headers.get('authorization');
        // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        //     return new NextResponse('Unauthorized', { status: 401 });
        // }

        console.log('[Cron] Running session auto-complete job');

        const result = await autoCompletePastSessions();

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
