import { getSupabaseAdmin } from '@/lib/supabaseServer';
import {
  createNotification,
  hasNotificationByDedupeKey,
} from '@/lib/dao/notificationsDao';
import { buildClassPreparationMessage } from '@/lib/classDelivery';

type ScheduledSession = {
  id: string;
  class_id: string;
  date_time: string;
  classes: {
    id: string;
    name: string;
    coach_id: string | null;
    type: 'WEEKLY' | 'EKSKUL';
    delivery_mode: 'ONLINE' | 'OFFLINE';
  } | Array<{
    id: string;
    name: string;
    coach_id: string | null;
    type: 'WEEKLY' | 'EKSKUL';
    delivery_mode: 'ONLINE' | 'OFFLINE';
  }> | null;
};

function getClass(session: ScheduledSession) {
  return Array.isArray(session.classes) ? session.classes[0] : session.classes;
}

function formatWibTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value));
}

async function notifyOnce(input: {
  userId: string;
  dedupeKey: string;
  title: string;
  message: string;
  actionUrl: string;
  priority: 'NORMAL' | 'HIGH';
}) {
  if (await hasNotificationByDedupeKey(input.userId, input.dedupeKey)) return false;
  await createNotification(input.userId, input.title, input.message, 'SESSION_REMINDER', {
    actionUrl: input.actionUrl,
    category: 'SCHEDULE',
    priority: input.priority,
    dedupeKey: input.dedupeKey,
    push: true,
    pushTag: input.dedupeKey,
  });
  return true;
}

export async function sendOneHourSessionReminders(now = new Date()) {
  const supabase = getSupabaseAdmin();
  const windowStart = new Date(now.getTime() + 50 * 60_000).toISOString();
  const windowEnd = new Date(now.getTime() + 70 * 60_000).toISOString();
  const { data, error } = await supabase
    .from('sessions')
    .select('id, class_id, date_time, classes(id, name, coach_id, type, delivery_mode)')
    .eq('status', 'SCHEDULED')
    .gte('date_time', windowStart)
    .lte('date_time', windowEnd);

  if (error) throw new Error(`Failed to load one-hour sessions: ${error.message}`);
  const sessions = (data ?? []) as unknown as ScheduledSession[];
  if (sessions.length === 0) return { sent: 0, sessions: 0 };

  const classIds = [...new Set(sessions.map((session) => session.class_id))];
  const { data: enrollmentRows, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('class_id, coder_id, users!enrollments_coder_id_fkey(id, is_active)')
    .in('class_id', classIds)
    .eq('status', 'ACTIVE');
  if (enrollmentError) throw new Error(`Failed to load reminder enrollments: ${enrollmentError.message}`);

  const coachIds = [...new Set(sessions.map((session) => getClass(session)?.coach_id).filter(Boolean))] as string[];
  const { data: coachRows, error: coachError } = coachIds.length
    ? await supabase.from('users' as any).select('id, is_active, notif_session_reminder').in('id', coachIds).eq('role', 'COACH')
    : { data: [], error: null };
  if (coachError) throw new Error(`Failed to load coach reminder preferences: ${coachError.message}`);
  const typedCoachRows = (coachRows ?? []) as unknown as Array<{ id: string; is_active: boolean; notif_session_reminder: boolean }>;
  const enabledCoachIds = new Set(typedCoachRows
    .filter((coach) => coach.is_active && coach.notif_session_reminder === true)
    .map((coach) => coach.id));

  const tasks: Array<Promise<boolean>> = [];
  for (const scheduled of sessions) {
    const klass = getClass(scheduled);
    if (!klass) continue;
    const time = formatWibTime(scheduled.date_time);
    if (klass.coach_id && enabledCoachIds.has(klass.coach_id)) {
      tasks.push(notifyOnce({
        userId: klass.coach_id,
        dedupeKey: `session-${scheduled.id}-coach-1h`,
        title: 'Kelas dimulai 1 jam lagi',
        message: `${klass.name} dimulai pukul ${time} WIB. Siapkan materi dan buka detail kelas sebelum sesi dimulai.`,
        actionUrl: `/coach/classes/${klass.id}`,
        priority: 'HIGH',
      }));
    }

    for (const enrollment of (enrollmentRows ?? [])) {
      if (enrollment.class_id !== scheduled.class_id) continue;
      const coder = Array.isArray(enrollment.users) ? enrollment.users[0] : enrollment.users;
      if (!coder?.id || coder.is_active === false) continue;
      tasks.push(notifyOnce({
        userId: coder.id,
        dedupeKey: `session-${scheduled.id}-coder-1h`,
        title: 'Kelas dimulai 1 jam lagi',
        message: `${klass.name} dimulai pukul ${time} WIB. ${buildClassPreparationMessage(klass)}`,
        actionUrl: '/coder/dashboard',
        priority: 'HIGH',
      }));
    }
  }

  const results = await Promise.allSettled(tasks);
  return {
    sent: results.filter((result) => result.status === 'fulfilled' && result.value).length,
    sessions: sessions.length,
  };
}

export async function sendCoderDayBeforeReminders(
  sessions: ScheduledSession[],
  dateKey: string,
) {
  if (sessions.length === 0) return { sent: 0 };
  const supabase = getSupabaseAdmin();
  const classIds = [...new Set(sessions.map((session) => session.class_id))];
  const { data: enrollmentRows, error } = await supabase
    .from('enrollments')
    .select('class_id, coder_id, users!enrollments_coder_id_fkey(id, is_active)')
    .in('class_id', classIds)
    .eq('status', 'ACTIVE');
  if (error) throw new Error(`Failed to load H-1 coder enrollments: ${error.message}`);

  const schedulesByCoder = new Map<string, string[]>();
  for (const scheduled of sessions) {
    const klass = getClass(scheduled);
    if (!klass) continue;
    for (const enrollment of (enrollmentRows ?? [])) {
      if (enrollment.class_id !== scheduled.class_id) continue;
      const coder = Array.isArray(enrollment.users) ? enrollment.users[0] : enrollment.users;
      if (!coder?.id || coder.is_active === false) continue;
      const schedule = `${klass.name}, pukul ${formatWibTime(scheduled.date_time)} WIB`;
      const existing = schedulesByCoder.get(coder.id) ?? [];
      if (!existing.includes(schedule)) existing.push(schedule);
      schedulesByCoder.set(coder.id, existing);
    }
  }

  const results = await Promise.allSettled([...schedulesByCoder.entries()].map(([coderId, schedules]) => notifyOnce({
    userId: coderId,
    dedupeKey: `coder-classes-${dateKey}-h1`,
    title: 'Pengingat kelas besok',
    message: `Besok ada ${schedules.length} kelas: ${schedules.join('; ')}. Buka dashboard untuk melihat link atau lokasi kelas.`,
    actionUrl: '/coder/dashboard',
    priority: 'NORMAL',
  })));

  return { sent: results.filter((result) => result.status === 'fulfilled' && result.value).length };
}
