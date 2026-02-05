import { NextResponse } from 'next/server';
import { checkAndSendClassReminders } from '@/lib/services/classReminderScheduler';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Optional: Check for Authorization header if you want to secure it
        // const authHeader = request.headers.get('authorization');
        // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        //     return new NextResponse('Unauthorized', { status: 401 });
        // }

        const result = await checkAndSendClassReminders();

        return NextResponse.json(result);
    } catch (error) {
        console.error('[Cron] Class reminder error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
