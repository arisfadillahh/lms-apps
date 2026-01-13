import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { checkAndSendPaymentReminders, markExpiredPeriods } from '@/lib/services/paymentReminderScheduler';

/**
 * API endpoint to trigger payment reminders
 * Can be called by:
 * - Admin manually
 * - Vercel Cron Jobs
 * - External scheduler (GitHub Actions, etc.)
 * 
 * Add to vercel.json for scheduled runs:
 * {
 *   "crons": [{
 *     "path": "/api/admin/payments/send-reminders",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 */
export async function POST(request: Request) {
    // Check for cron secret or admin session
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (cronSecret && cronSecret === expectedSecret) {
        // Valid cron request
    } else {
        // Fall back to session auth
        const session = await getSessionOrThrow();
        await assertRole(session, 'ADMIN');
    }

    try {
        // First, mark any expired periods
        const expiredCount = await markExpiredPeriods();

        // Then send reminders for expiring periods
        const result = await checkAndSendPaymentReminders(7); // 7 days threshold

        return NextResponse.json({
            success: true,
            expiredMarked: expiredCount,
            remindersSent: result.sent,
            remindersFailed: result.failed,
            errors: result.errors,
        });
    } catch (error) {
        console.error('[Send Reminders API] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to process reminders',
        }, { status: 500 });
    }
}

// GET for manual testing
export async function GET() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    return NextResponse.json({
        message: 'Use POST to trigger reminders',
        info: 'Set CRON_SECRET env var and pass x-cron-secret header for automated calls',
    });
}
