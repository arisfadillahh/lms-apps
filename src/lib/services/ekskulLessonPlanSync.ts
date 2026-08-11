import { addDays } from 'date-fns';

import { DAY_CODE_MAP } from '@/lib/constants/scheduleConstants';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { TablesRow } from '@/types/supabase';

type ClassRow = TablesRow<'classes'>;

function normalizeScheduleTime(time: string): string {
  const [hour = '00', minute = '00', second = '00'] = time.split(':');
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.slice(0, 2).padStart(2, '0')}`;
}

function alignDateToWeekday(start: Date, targetIndex: number): Date {
  const aligned = new Date(start);
  const currentIndex = aligned.getDay();
  const delta = (targetIndex - currentIndex + 7) % 7;
  aligned.setDate(aligned.getDate() + delta);
  return aligned;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function getPlanMeetingCount(planId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('ekskul_lessons')
    .select('estimated_meetings')
    .eq('plan_id', planId)
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to count ekskul plan meetings: ${error.message}`);
  }

  return (data ?? []).reduce((sum, lesson) => sum + Math.max(1, lesson.estimated_meetings ?? 1), 0);
}

export async function renumberEkskulLessons(planId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: lessons, error } = await supabase
    .from('ekskul_lessons')
    .select('id, order_index')
    .eq('plan_id', planId)
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to load ekskul lessons for renumbering: ${error.message}`);
  }

  const orderedLessons = lessons ?? [];
  for (let index = 0; index < orderedLessons.length; index += 1) {
    const nextOrderIndex = index + 1;
    const lesson = orderedLessons[index];
    if (lesson.order_index === nextOrderIndex) continue;

    const { error: updateError } = await supabase
      .from('ekskul_lessons')
      .update({ order_index: nextOrderIndex })
      .eq('id', lesson.id);

    if (updateError) {
      throw new Error(`Failed to renumber ekskul lesson: ${updateError.message}`);
    }
  }
}

export async function reorderEkskulLesson(planId: string, lessonId: string, targetOrderIndex: number): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: lessons, error } = await supabase
    .from('ekskul_lessons')
    .select('id, order_index')
    .eq('plan_id', planId)
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to load ekskul lessons for reordering: ${error.message}`);
  }

  const orderedLessons = (lessons ?? []).slice().sort((a, b) => {
    if (a.order_index !== b.order_index) return a.order_index - b.order_index;
    return a.id.localeCompare(b.id);
  });
  const movingLesson = orderedLessons.find((lesson) => lesson.id === lessonId);
  if (!movingLesson) return;

  const withoutMovingLesson = orderedLessons.filter((lesson) => lesson.id !== lessonId);
  const insertIndex = Math.max(0, Math.min(targetOrderIndex - 1, withoutMovingLesson.length));
  withoutMovingLesson.splice(insertIndex, 0, movingLesson);

  for (let index = 0; index < withoutMovingLesson.length; index += 1) {
    const nextOrderIndex = index + 1;
    const lesson = withoutMovingLesson[index];
    if (lesson.order_index === nextOrderIndex) continue;

    const { error: updateError } = await supabase
      .from('ekskul_lessons')
      .update({ order_index: nextOrderIndex })
      .eq('id', lesson.id);

    if (updateError) {
      throw new Error(`Failed to reorder ekskul lesson: ${updateError.message}`);
    }
  }
}

export async function refreshEkskulPlanTotal(planId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from('ekskul_lessons')
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', planId);

  if (error) {
    throw new Error(`Failed to count ekskul lessons: ${error.message}`);
  }

  await supabase
    .from('ekskul_lesson_plans')
    .update({ total_lessons: count ?? 0 })
    .eq('id', planId);
}

export async function syncEkskulClassesForPlan(planId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const desiredMeetingCount = await getPlanMeetingCount(planId);

  const { data: classes, error: classesError } = await supabase
    .from('classes')
    .select('*')
    .eq('type', 'EKSKUL')
    .eq('ekskul_lesson_plan_id', planId);

  if (classesError) {
    throw new Error(`Failed to load ekskul classes for sync: ${classesError.message}`);
  }

  for (const classRecord of (classes ?? []) as ClassRow[]) {
    await syncEkskulClassSessionCount(classRecord, desiredMeetingCount);
  }
}

export async function syncEkskulPlanAfterChange(planId: string): Promise<void> {
  await renumberEkskulLessons(planId);
  await refreshEkskulPlanTotal(planId);
  await syncEkskulClassesForPlan(planId);
}

async function syncEkskulClassSessionCount(classRecord: ClassRow, desiredMeetingCount: number): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, date_time, status')
    .eq('class_id', classRecord.id)
    .order('date_time', { ascending: true });

  if (error) {
    throw new Error(`Failed to load ekskul class sessions: ${error.message}`);
  }

  const activeSessions = (sessions ?? []).filter((session) => session.status !== 'CANCELLED');
  const completedCount = activeSessions.filter((session) => session.status === 'COMPLETED').length;
  const minimumCount = Math.max(desiredMeetingCount, completedCount);

  if (activeSessions.length < minimumCount) {
    await appendEkskulSessions(classRecord, sessions ?? [], minimumCount - activeSessions.length);
    return;
  }

  if (activeSessions.length > minimumCount) {
    const removableIds = activeSessions
      .filter((session) => session.status === 'SCHEDULED')
      .slice()
      .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime())
      .slice(0, activeSessions.length - minimumCount)
      .map((session) => session.id);

    if (removableIds.length > 0) {
      const { error: deleteError } = await supabase.from('sessions').delete().in('id', removableIds);
      if (deleteError) {
        throw new Error(`Failed to remove extra ekskul sessions: ${deleteError.message}`);
      }
    }
  }
}

async function appendEkskulSessions(
  classRecord: ClassRow,
  existingSessions: Array<{ date_time: string }>,
  count: number,
): Promise<void> {
  if (count <= 0) return;

  const scheduleInfo = DAY_CODE_MAP[classRecord.schedule_day.trim().toUpperCase()];
  if (!scheduleInfo) {
    throw new Error(`Invalid ekskul schedule day "${classRecord.schedule_day}"`);
  }

  const sortedSessions = existingSessions
    .slice()
    .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  const lastSession = sortedSessions[sortedSessions.length - 1] ?? null;
  const firstDate = lastSession
    ? addDays(new Date(lastSession.date_time), 7)
    : alignDateToWeekday(new Date(classRecord.start_date ?? new Date().toISOString()), scheduleInfo.index);

  const payload = Array.from({ length: count }, (_, index) => {
    const sessionDate = addDays(firstDate, index * 7);
    return {
      class_id: classRecord.id,
      date_time: `${toDateOnly(sessionDate)}T${normalizeScheduleTime(classRecord.schedule_time)}+07:00`,
      zoom_link_snapshot: classRecord.zoom_link,
      status: 'SCHEDULED' as const,
    };
  });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('sessions').insert(payload);
  if (error) {
    throw new Error(`Failed to append ekskul sessions: ${error.message}`);
  }
}
