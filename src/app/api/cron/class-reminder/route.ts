import { NextResponse } from 'next/server';
import { checkAndSendClassReminders } from '@/lib/services/classReminderScheduler';
import { processDueEventBroadcasts } from '@/lib/services/eventBroadcastService';
import { verifyCronRequest } from '@/lib/cron';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        if (!verifyCronRequest(request)) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const result = await checkAndSendClassReminders();
        const eventResult = await processDueEventBroadcasts();

        return NextResponse.json({ ...result, eventReminders: eventResult });
    } catch (error) {
        console.error('[Cron] Class reminder error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
