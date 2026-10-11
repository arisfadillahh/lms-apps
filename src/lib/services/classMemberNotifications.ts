import { createNotification } from '@/lib/dao/notificationsDao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type SessionChangeKind = 'RESCHEDULED' | 'CANCELLED';

function formatSession(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value));
}

export async function notifyClassMembersAboutSessionChange(sessionId: string, kind: SessionChangeKind) {
  const supabase = getSupabaseAdmin();
  const { data: scheduled, error } = await supabase
    .from('sessions')
    .select('id, class_id, date_time, substitute_coach_id, classes(id, name, coach_id)')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !scheduled) throw new Error(error?.message || 'Session not found for notification');
  const klass = Array.isArray(scheduled.classes) ? scheduled.classes[0] : scheduled.classes;
  if (!klass) return;

  const { data: enrollments, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('coder_id')
    .eq('class_id', scheduled.class_id)
    .eq('status', 'ACTIVE');
  if (enrollmentError) throw new Error(enrollmentError.message);

  const when = formatSession(scheduled.date_time);
  const isCancelled = kind === 'CANCELLED';
  const title = isCancelled ? 'Sesi kelas dibatalkan' : 'Jadwal sesi berubah';
  const message = isCancelled
    ? `Sesi ${klass.name} pada ${when} dibatalkan. Cek dashboard untuk jadwal berikutnya.`
    : `Sesi ${klass.name} dijadwalkan ulang menjadi ${when}.`;
  const eventKey = `${kind.toLowerCase()}-${sessionId}-${scheduled.date_time}`;
  const coachIds = [...new Set([klass.coach_id, scheduled.substitute_coach_id].filter(Boolean))] as string[];
  const tasks: Array<Promise<void>> = coachIds.map((coachId) => createNotification(
    coachId,
    title,
    message,
    'SESSION_CHANGED',
    {
      actionUrl: `/coach/classes/${klass.id}`,
      category: 'SCHEDULE',
      priority: 'HIGH',
      dedupeKey: `${eventKey}-${coachId}`,
      push: true,
      pushTag: `session-${sessionId}`,
    },
  ));
  for (const enrollment of enrollments ?? []) {
    tasks.push(createNotification(
      enrollment.coder_id,
      title,
      message,
      'SESSION_CHANGED',
      {
        actionUrl: '/coder/dashboard',
        category: 'SCHEDULE',
        priority: 'HIGH',
        dedupeKey: `${eventKey}-${enrollment.coder_id}`,
        push: true,
        pushTag: `session-${sessionId}`,
      },
    ));
  }
  await Promise.allSettled(tasks);
}

export async function notifySubstituteCoach(sessionId: string, substituteCoachId: string) {
  const supabase = getSupabaseAdmin();
  const { data: scheduled, error } = await supabase
    .from('sessions')
    .select('id, class_id, date_time, classes(id, name)')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !scheduled) throw new Error(error?.message || 'Session not found for substitute notification');
  const klass = Array.isArray(scheduled.classes) ? scheduled.classes[0] : scheduled.classes;
  if (!klass) return;
  await createNotification(
    substituteCoachId,
    'Assignment Coach pengganti',
    `Anda ditugaskan menggantikan sesi ${klass.name} pada ${formatSession(scheduled.date_time)}.`,
    'SUBSTITUTE_ASSIGNED',
    {
      actionUrl: `/coach/classes/${klass.id}`,
      category: 'SCHEDULE',
      priority: 'HIGH',
      dedupeKey: `substitute-${sessionId}-${substituteCoachId}`,
      push: true,
      pushTag: `session-${sessionId}`,
    },
  );
}
