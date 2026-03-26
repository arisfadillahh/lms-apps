import { NextResponse } from 'next/server';
import { checkAndSendClassReminders } from '@/lib/services/classReminderScheduler';
import { verifyCronRequest } from '@/lib/cron';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    if (!verifyCronRequest(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await checkAndSendClassReminders();
        return NextResponse.json(result);
    } catch (error) {
        console.error('[API] Class reminder job error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
