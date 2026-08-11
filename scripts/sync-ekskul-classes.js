const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const DAY_CODE_MAP = {
  SU: 0,
  SUN: 0,
  SUNDAY: 0,
  MO: 1,
  MON: 1,
  MONDAY: 1,
  TU: 2,
  TUE: 2,
  TUESDAY: 2,
  WE: 3,
  WED: 3,
  WEDNESDAY: 3,
  TH: 4,
  THU: 4,
  THURSDAY: 4,
  FR: 5,
  FRI: 5,
  FRIDAY: 5,
  SA: 6,
  SAT: 6,
  SATURDAY: 6,
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeScheduleTime(time) {
  const [hour = '00', minute = '00', second = '00'] = String(time || '').split(':');
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.slice(0, 2).padStart(2, '0')}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function alignDateToWeekday(start, targetIndex) {
  const aligned = new Date(start);
  const delta = (targetIndex - aligned.getDay() + 7) % 7;
  aligned.setDate(aligned.getDate() + delta);
  return aligned;
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

async function getPlanMeetingCount(supabase, planId) {
  const { data, error } = await supabase
    .from('ekskul_lessons')
    .select('estimated_meetings')
    .eq('plan_id', planId)
    .order('order_index', { ascending: true });

  if (error) throw new Error(`Failed to count plan ${planId}: ${error.message}`);
  return (data || []).reduce((sum, lesson) => sum + Math.max(1, lesson.estimated_meetings || 1), 0);
}

async function appendSessions(supabase, classRecord, existingSessions, count) {
  if (count <= 0) return 0;

  const scheduleIndex = DAY_CODE_MAP[String(classRecord.schedule_day || '').trim().toUpperCase()];
  if (scheduleIndex === undefined) {
    throw new Error(`Invalid schedule day for class ${classRecord.id}: ${classRecord.schedule_day}`);
  }

  const sorted = existingSessions
    .slice()
    .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  const lastSession = sorted[sorted.length - 1] || null;
  const firstDate = lastSession
    ? addDays(new Date(lastSession.date_time), 7)
    : alignDateToWeekday(new Date(classRecord.start_date || new Date().toISOString()), scheduleIndex);

  const payload = Array.from({ length: count }, (_, index) => {
    const sessionDate = addDays(firstDate, index * 7);
    return {
      class_id: classRecord.id,
      date_time: `${toDateOnly(sessionDate)}T${normalizeScheduleTime(classRecord.schedule_time)}+07:00`,
      zoom_link_snapshot: classRecord.zoom_link,
      status: 'SCHEDULED',
    };
  });

  const { error } = await supabase.from('sessions').insert(payload);
  if (error) throw new Error(`Failed to append sessions for ${classRecord.id}: ${error.message}`);
  return payload.length;
}

async function syncClass(supabase, classRecord, desiredMeetingCount) {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, date_time, status')
    .eq('class_id', classRecord.id)
    .order('date_time', { ascending: true });

  if (error) throw new Error(`Failed to load sessions for ${classRecord.id}: ${error.message}`);

  const activeSessions = (sessions || []).filter((session) => session.status !== 'CANCELLED');
  const completedCount = activeSessions.filter((session) => session.status === 'COMPLETED').length;
  const targetCount = Math.max(desiredMeetingCount, completedCount);

  if (activeSessions.length < targetCount) {
    const added = await appendSessions(supabase, classRecord, sessions || [], targetCount - activeSessions.length);
    return { added, removed: 0 };
  }

  if (activeSessions.length > targetCount) {
    const removableIds = activeSessions
      .filter((session) => session.status === 'SCHEDULED')
      .slice()
      .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime())
      .slice(0, activeSessions.length - targetCount)
      .map((session) => session.id);

    if (removableIds.length > 0) {
      const { error: deleteError } = await supabase.from('sessions').delete().in('id', removableIds);
      if (deleteError) throw new Error(`Failed to remove sessions for ${classRecord.id}: ${deleteError.message}`);
    }
    return { added: 0, removed: removableIds.length };
  }

  return { added: 0, removed: 0 };
}

async function main() {
  const supabase = getSupabase();
  const { data: classes, error } = await supabase
    .from('classes')
    .select('*')
    .eq('type', 'EKSKUL')
    .not('ekskul_lesson_plan_id', 'is', null);

  if (error) throw new Error(`Failed to load ekskul classes: ${error.message}`);

  let added = 0;
  let removed = 0;
  for (const classRecord of classes || []) {
    const desiredMeetingCount = await getPlanMeetingCount(supabase, classRecord.ekskul_lesson_plan_id);
    const result = await syncClass(supabase, classRecord, desiredMeetingCount);
    added += result.added;
    removed += result.removed;
    console.log(`${classRecord.name}: target=${desiredMeetingCount}, added=${result.added}, removed=${result.removed}`);
  }

  console.log(`Synced ${(classes || []).length} ekskul classes. Added ${added}, removed ${removed}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
