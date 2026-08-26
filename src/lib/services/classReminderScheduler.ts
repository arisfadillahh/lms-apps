import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getInvoiceSettings } from '@/lib/dao/invoicesDao';
import { sendClassReminder } from '@/lib/services/whatsappClient';
import { buildClassReminderIdempotencyKey } from '@/lib/services/reminderIdempotency';
import { sendCoderDayBeforeReminders, sendOneHourSessionReminders } from '@/lib/services/roleSessionReminders';
import { filterParentWhatsappReminderSessions } from '@/lib/classReminderEligibility';
import { renderClassReminderMessage, type ClassDeliveryDetails } from '@/lib/classDelivery';

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

    const now = new Date();

    // This job may run more than once per hour. Dedupe keys keep the one-hour
    // Coach/Coder push actionable without stacking duplicate alerts.
    try {
        await sendOneHourSessionReminders(now);
    } catch (roleReminderError) {
        console.error('[Scheduler] Failed to send one-hour role reminders:', roleReminderError);
    }

    // 2. Check Time Logic
    // Format: "HH:mm" (e.g., "09:00")
    const targetTime = settings.class_reminder_time || '09:00';

    // Use Indonesia time (WIB) for calculations
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
    // CHANGE: Instead of returning early if ANY log exists, we fetch the list of parents
    // who already received the reminder, and filter them out later.
    const startOfDayWib = `${todayStr}T00:00:00+07:00`;

    const { data: logs } = await supabase
        .from('whatsapp_message_logs')
        .select('payload')
        .eq('category', 'REMINDER' as any)
        .gte('created_at', startOfDayWib);

    // Get list of parent phones that already received CLASS_REMINDER today
    const sentParentPhones = new Set<string>();
    const sentReminderKeys = new Set<string>();

    if (logs && logs.length > 0) {
        logs.forEach((log: any) => {
            if (log.payload?.type === 'CLASS_REMINDER' && log.payload?.parent_phone) {
                sentParentPhones.add(log.payload.parent_phone);
            }
            if (log.payload?.type === 'CLASS_REMINDER' && log.payload?.idempotency_key) {
                sentReminderKeys.add(log.payload.idempotency_key);
            }
        });
    }

    console.log(`[Scheduler] Found ${sentParentPhones.size} parents who already received reminders today.`);

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
        .select('id, date_time, class_id, classes(id, name, zoom_link, type, delivery_mode, location_name, location_address, location_maps_url, parent_whatsapp_enabled)')
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

    type RawReminderSession = {
        id: string;
        date_time: string;
        class_id: string;
        classes: ({
            id: string;
            name: string;
            zoom_link: string | null;
            type: 'WEEKLY' | 'EKSKUL';
            delivery_mode: 'ONLINE' | 'OFFLINE';
            location_name: string | null;
            location_address: string | null;
            location_maps_url: string | null;
            parent_whatsapp_enabled: boolean;
        } & ClassDeliveryDetails) | Array<({
            id: string;
            name: string;
            zoom_link: string | null;
            type: 'WEEKLY' | 'EKSKUL';
            delivery_mode: 'ONLINE' | 'OFFLINE';
            location_name: string | null;
            location_address: string | null;
            location_maps_url: string | null;
            parent_whatsapp_enabled: boolean;
        } & ClassDeliveryDetails)> | null;
    };
    const allSessions = (rawSessions ?? []) as RawReminderSession[];

    try {
        await sendCoderDayBeforeReminders(allSessions as any, tomorrowStr);
    } catch (coderReminderError) {
        console.error('[Scheduler] Failed to send H-1 Coder reminders:', coderReminderError);
    }

    const classIds = [...new Set(allSessions.map(s => s.class_id).filter(Boolean))];
    const parentWhatsappSessions = filterParentWhatsappReminderSessions(allSessions);
    const parentWhatsappClassIds = [...new Set(parentWhatsappSessions.map(s => s.class_id).filter(Boolean))];
    const enrollmentResult = parentWhatsappClassIds.length > 0
        ? await supabase
            .from('enrollments')
            .select('coder_id, class_id, users(id, full_name, parent_name, parent_contact_phone)')
            .in('class_id', parentWhatsappClassIds)
            .eq('status', 'ACTIVE')
        : { data: [], error: null };
    const enrollments = enrollmentResult.data ?? [];

    console.log(`[Scheduler] Enrollments found for tomorrow:`, {
        total: enrollments?.length || 0
    });

    // Map sessions to their enrolled students
    const sessions = parentWhatsappSessions.flatMap(s => {
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
        klass: ClassDeliveryDetails;
        idempotencyKey: string;
    }>();

    for (const session of sessions) {
        const coder = (session.coder as any);
        const phone = coder?.parent_contact_phone;

        if (!phone) continue;

        // SKIP if this parent already received a reminder today
        const idempotencyKey = buildClassReminderIdempotencyKey(tomorrowStr, phone);
        if (sentParentPhones.has(phone) || sentReminderKeys.has(idempotencyKey)) {
            continue;
        }

        if (!reminders.has(phone)) {
            const time = new Date(session.date_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            reminders.set(phone, {
                parentName: coder.parent_name || 'Ayah/Bunda',
                students: [],
                time: time,
                klass: (session.class as any) ?? {},
                idempotencyKey,
            });
        }

        const entry = reminders.get(phone)!;
        if (!entry.students.includes(coder.full_name)) {
            entry.students.push(coder.full_name);
        }
    }

    // 6. Send Messages to Parents
    let sentCount = 0;
    const template = settings.class_reminder_message_template || '';

    for (const [phone, data] of reminders) {
        const msg = renderClassReminderMessage({
            template,
            parentName: data.parentName,
            studentNames: data.students,
            time: data.time,
            klass: data.klass,
        });

        const response = await sendClassReminder(phone, msg, data.students.join(', '), 'CLASS_REMINDER', data.idempotencyKey);
        if (!response.skipped) {
            sentCount++;
        }

        // Random Delay
        const minDelay = settings.class_reminder_delay_min || 5;
        const maxDelay = settings.class_reminder_delay_max || 15;
        const delayMs = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 1000;

        await new Promise(r => setTimeout(r, delayMs));
    }

    // 7. Send In-App Notifications to Coaches
    try {
        const { createNotification, hasMatchingNotificationToday } = await import('@/lib/dao/notificationsDao');
        const { getUsersByIds } = await import('@/lib/dao/usersDao');
        
        // Find coach_id for each session
        const { data: coachesClasses } = await supabase
            .from('classes')
            .select('id, name, coach_id')
            .in('id', classIds);

        if (coachesClasses && coachesClasses.length > 0) {
            // Group sessions by coach to send one summarized notification
            const coachSchedules = new Map<string, string[]>(); // coach_id -> array of descriptions
            
            for (const session of allSessions) {
                const cls = coachesClasses.find(c => c.id === session.class_id);
                if (cls && cls.coach_id) {
                    const time = new Date(session.date_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    const desc = `- ${cls.name} (${time} WIB)`;
                    
                    if (!coachSchedules.has(cls.coach_id)) {
                        coachSchedules.set(cls.coach_id, []);
                    }
                    if (!coachSchedules.get(cls.coach_id)!.includes(desc)) {
                        coachSchedules.get(cls.coach_id)!.push(desc);
                    }
                }
            }
            
            // Get coach preferences
            const uniqueCoachIds = Array.from(coachSchedules.keys());
            const coaches = await getUsersByIds(uniqueCoachIds);
            
            for (const coach of coaches) {
                const wantsNotif = (coach as any).notif_session_reminder === true; // Note: defaults to false per migration
                
                if (wantsNotif) {
                    const scheduleList = coachSchedules.get(coach.id)?.join('\n') || '';
                    const message = `Anda memiliki ${coachSchedules.get(coach.id)?.length} sesi kelas besok:\n${scheduleList}\n\nMohon persiapkan materi dan hadir tepat waktu.`;
                    const title = 'Pengingat Sesi';
                    const type = 'SYSTEM';

                    if (!await hasMatchingNotificationToday(coach.id, title, message, type)) {
                        await createNotification(coach.id, title, message, type, {
                            actionUrl: '/coach/dashboard',
                            category: 'SCHEDULE',
                            priority: 'NORMAL',
                            dedupeKey: `coach-classes-${tomorrowStr}-h1`,
                            push: true,
                            pushTag: `coach-classes-${tomorrowStr}-h1`,
                        });
                    }
                }
            }
        }
    } catch (coachNotifError) {
        console.error('[Scheduler] Failed to send coach internal notifications:', coachNotifError);
    }

    return { success: true, sent: sentCount, message: 'Reminders sent' };
}
