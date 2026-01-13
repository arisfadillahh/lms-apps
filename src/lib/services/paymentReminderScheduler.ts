/**
 * Payment Reminder Scheduler
 * 
 * This service checks for expiring payment periods and sends reminders.
 * Can be triggered:
 * - Via API endpoint (e.g., called by cron job)
 * - Via Next.js API route + external scheduler
 * - Via Vercel Cron Jobs (if deployed on Vercel)
 */

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { sendPaymentReminder } from './whatsappReminder';

type ReminderResult = {
    sent: number;
    failed: number;
    errors: string[];
};

/**
 * Check and send reminders for payment periods expiring within specified days
 */
export async function checkAndSendPaymentReminders(daysThreshold: number = 7): Promise<ReminderResult> {
    const supabase = getSupabaseAdmin();
    const result: ReminderResult = { sent: 0, failed: 0, errors: [] };

    const today = new Date();
    const thresholdDate = new Date(today);
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    // Fetch active periods expiring within threshold
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: periods, error } = await (supabase as any)
        .from('coder_payment_periods')
        .select(`
      *,
      users!coder_payment_periods_coder_id_fkey(full_name, parent_contact_phone)
    `)
        .eq('status', 'ACTIVE')
        .lte('end_date', thresholdDate.toISOString().split('T')[0])
        .order('end_date', { ascending: true });

    if (error) {
        console.error('[Reminder Scheduler] Error fetching periods:', error);
        result.errors.push('Failed to fetch payment periods');
        return result;
    }

    if (!periods || periods.length === 0) {
        console.log('[Reminder Scheduler] No expiring periods found');
        return result;
    }

    // Send reminders for each period
    for (const period of periods) {
        const phone = period.users?.parent_contact_phone;
        const coderName = period.users?.full_name || 'Coder';

        if (!phone) {
            result.errors.push(`No phone for coder ${coderName}`);
            result.failed++;
            continue;
        }

        const daysRemaining = Math.ceil(
            (new Date(period.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if we already sent a reminder recently for this period
        const { data: recentReminder } = await (supabase as any)
            .from('payment_reminders')
            .select('id')
            .eq('period_id', period.id)
            .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
            .limit(1);

        if (recentReminder && recentReminder.length > 0) {
            console.log(`[Reminder Scheduler] Already sent reminder for period ${period.id} recently`);
            continue;
        }

        try {
            const sendResult = await sendPaymentReminder(phone, coderName, daysRemaining, period.total_amount);

            if (sendResult.success) {
                // Record the reminder
                await (supabase as any)
                    .from('payment_reminders')
                    .insert({
                        period_id: period.id,
                        reminder_type: daysRemaining < 0 ? 'EXPIRED' : daysRemaining === 0 ? 'TODAY' : 'UPCOMING',
                        days_before_expiry: Math.max(0, daysRemaining),
                        sent_at: new Date().toISOString(),
                        status: 'SENT',
                    });

                result.sent++;
                console.log(`[Reminder Scheduler] Sent reminder to ${phone} for ${coderName}`);
            } else {
                result.failed++;
                result.errors.push(sendResult.error || 'Unknown error');
            }
        } catch (err) {
            result.failed++;
            result.errors.push(String(err));
        }
    }

    return result;
}

/**
 * Mark expired periods as EXPIRED (not just expiring soon)
 */
export async function markExpiredPeriods(): Promise<number> {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().split('T')[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from('coder_payment_periods')
        .update({ status: 'EXPIRED' })
        .eq('status', 'ACTIVE')
        .lt('end_date', today)
        .select('id');

    if (error) {
        console.error('[Reminder Scheduler] Error marking expired periods:', error);
        return 0;
    }

    return data?.length || 0;
}
