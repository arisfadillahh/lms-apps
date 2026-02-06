import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getInvoiceSettings } from '@/lib/dao/invoicesDao';
import { sendClassReminder } from '@/lib/services/whatsappClient';

/**
 * Check and Send Class Reminders for "Today"
 * Designed to be called periodically (e.g., hourly) by a Cron Job.
 */
export async function checkAndSendClassReminders(): Promise<{
    success: boolean;
    sent: number;
    message: string;
    skippedReason?: string;
}> {
    const supabase = getSupabaseAdmin();
    const settings = await getInvoiceSettings();

    if (!settings) {
        return { success: false, sent: 0, message: 'Settings not found' };
    }

    // 1. Check Feature Enabled
    if (!settings.enable_class_reminder) {
        return { success: true, sent: 0, message: 'Feature disabled', skippedReason: 'DISABLED' };
    }

    // 2. Check Time Logic
    // Format: "HH:mm" (e.g., "09:00")
    const targetTime = settings.class_reminder_time || '09:00';

    // Use Indonesia time (WIB) for calculations
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(now);
    const find = (type: string) => parts.find(p => p.type === type)?.value;

    const currentHours = parseInt(find('hour') || '0');
    const currentMinutes = parseInt(find('minute') || '0');
    const todayStr = `${find('year')}-${find('month')}-${find('day')}`;

    // Calculate Tomorrow's Date for H-1 Reminder
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowParts = formatter.formatToParts(tomorrow);
    const findTomorrow = (type: string) => tomorrowParts.find(p => p.type === type)?.value;
    const tomorrowStr = `${findTomorrow('year')}-${findTomorrow('month')}-${findTomorrow('day')}`;

    console.log(`[Scheduler] Checking H-1 reminders for ${tomorrowStr} at ${currentHours}:${currentMinutes} WIB`);

    const [targetHours, targetMinutes] = targetTime.split(':').map(Number);

    // If current time is earlier than target time, skip.
    if (currentHours < targetHours || (currentHours === targetHours && currentMinutes < targetMinutes)) {
        return { success: true, sent: 0, message: `Too early (Target: ${targetTime}, Now: ${currentHours}:${currentMinutes} WIB)`, skippedReason: 'TOO_EARLY' };
    }

    // 3. Check Duplicate Execution (Has ran today for H-1 target?)
    // We check logs for 'REMINDER' category with type CLASS_REMINDER created today (WIB).
    // The key is that we only want to run this ONCE per day (today) to send reminders for TOMORROW.
    const startOfDayWib = `${todayStr}T00:00:00+07:00`;

    const { data: logs } = await supabase
        .from('whatsapp_message_logs')
        .select('payload')
        .eq('category', 'REMINDER' as any)
        .gte('created_at', startOfDayWib);

    // Check if any of these logs are CLASS_REMINDER type
    const hasClassReminderToday = logs?.some((log: any) =>
        log.payload?.type === 'CLASS_REMINDER'
    );

    if (hasClassReminderToday) {
        return { success: true, sent: 0, message: 'Already sent today (H-1 reminders)', skippedReason: 'ALREADY_SENT' };
    }

    // 4. Fetch Sessions for TOMORROW (WIB) - Correct Query Path
    const startFilter = `${tomorrowStr}T00:00:00+07:00`;
    const endFilter = `${tomorrowStr}T23:59:59+07:00`;

    console.log(`[Scheduler] Querying sessions for tomorrow with:`, {
        status: 'SCHEDULED',
        dateRange: { start: startFilter, end: endFilter }
    });

    // Query sessions with classes first
    const { data: rawSessions, error: sessionError } = await supabase
        .from('sessions')
        .select('id, date_time, class_id, classes(id, name, zoom_link)')
        .eq('status', 'SCHEDULED' as any)
        .gte('date_time', startFilter)
        .lte('date_time', endFilter);

    console.log(`[Scheduler] Raw sessions result:`, {
        error: sessionError?.message,
        sessionsFound: rawSessions?.length || 0,
    });

    if (sessionError || !rawSessions || rawSessions.length === 0) {
        console.log('[Scheduler] No sessions found for tomorrow or error occurred');
        return { success: true, sent: 0, message: 'No sessions tomorrow', skippedReason: 'NO_SESSIONS' };
    }

    // Fetch enrollments for classes
    const classIds = [...new Set(rawSessions.map(s => s.class_id).filter(Boolean))];

    const { data: enrollments } = await supabase
        .from('enrollments')
        .select('coder_id, class_id, users(id, full_name, parent_name, parent_contact_phone)')
        .in('class_id', classIds)
        .eq('status', 'ACTIVE');

    console.log(`[Scheduler] Enrollments found for tomorrow:`, {
        total: enrollments?.length || 0
    });

    // Map sessions to their enrolled students
    const sessions = rawSessions.flatMap(s => {
        const classEnrollments = enrollments?.filter(e => e.class_id === s.class_id) || [];
        const classData = Array.isArray(s.classes) ? s.classes[0] : s.classes;

        // Create one "session" entry per enrolled student
        return classEnrollments.map(enrollment => ({
            id: s.id,
            date_time: s.date_time,
            coder: Array.isArray(enrollment.users) ? enrollment.users[0] : enrollment.users,
            class: classData
        }));
    });

    console.log(`[Scheduler] Enriched sessions (H-1):`, {
        total: sessions.length,
        firstSession: sessions[0] ? {
            id: sessions[0].id,
            date_time: sessions[0].date_time,
            coder: sessions[0].coder?.full_name,
            class: sessions[0].class?.name
        } : null
    });

    // 5. Group by Parent Phone to avoid spamming
    const reminders = new Map<string, {
        parentName: string;
        students: string[];
        time: string;
        zoomLink: string;
    }>();

    for (const session of sessions) {
        const coder = (session.coder as any);
        const phone = coder?.parent_contact_phone;

        if (!phone) continue;

        if (!reminders.has(phone)) {
            const time = new Date(session.date_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            reminders.set(phone, {
                parentName: coder.parent_name || 'Ayah/Bunda',
                students: [],
                time: time,
                zoomLink: (session.class as any)?.zoom_link || '-'
            });
        }

        const entry = reminders.get(phone)!;
        if (!entry.students.includes(coder.full_name)) {
            entry.students.push(coder.full_name);
        }
    }

    // 6. Send Messages
    let sentCount = 0;
    const template = settings.class_reminder_message_template || '';

    for (const [phone, data] of reminders) {
        // Simple template replacement
        const msg = template
            .replace('{parent_name}', data.parentName)
            .replace('{student_name}', data.students.join(', '))
            .replace('{time}', data.time)
            .replace('{zoom_link}', data.zoomLink);

        await sendClassReminder(phone, msg, data.students.join(', '));
        sentCount++;

        // Random Delay
        const minDelay = settings.class_reminder_delay_min || 5;
        const maxDelay = settings.class_reminder_delay_max || 15;
        const delayMs = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 1000;

        await new Promise(r => setTimeout(r, delayMs));
    }

    return { success: true, sent: sentCount, message: 'Reminders sent' };
}
