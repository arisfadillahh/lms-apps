import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { DAY_CODE_MAP } from '@/lib/constants/scheduleConstants';
import { createNotification } from '@/lib/dao/notificationsDao';
import { buildRecurringScheduleUpdates } from '@/lib/services/classScheduleReflow';

const schema = z.object({
  scheduleDay: z.string().min(2),
  scheduleTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Hari atau jam jadwal tidak valid' }, { status: 400 });

  const schedule = DAY_CODE_MAP[parsed.data.scheduleDay.trim().toUpperCase()];
  if (!schedule) return NextResponse.json({ error: 'Hari jadwal tidak valid' }, { status: 400 });

  const classId = (await params).id;
  const supabase = getSupabaseAdmin();
  const { data: klass, error: classError } = await supabase.from('classes').select('id, name, coach_id, schedule_day, schedule_time, zoom_link').eq('id', classId).maybeSingle();
  if (classError) return NextResponse.json({ error: classError.message }, { status: 500 });
  if (!klass) return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });

  const { data: sessions, error: sessionsError } = await supabase.from('sessions').select('id, date_time, status').eq('class_id', classId).order('date_time', { ascending: true });
  if (sessionsError) return NextResponse.json({ error: sessionsError.message }, { status: 500 });

  const futureSessions = (sessions ?? []).filter((session) => session.status === 'SCHEDULED' && new Date(session.date_time).getTime() > Date.now());
  const sessionIds = futureSessions.map((futureSession) => futureSession.id);
  const { data: assignedLessons, error: assignedLessonsError } = sessionIds.length
    ? await supabase.from('class_lessons').select('session_id, order_index, class_block_id').in('session_id', sessionIds)
    : { data: [], error: null };
  if (assignedLessonsError) return NextResponse.json({ error: assignedLessonsError.message }, { status: 500 });

  const blockIds = [...new Set((assignedLessons ?? []).map((lesson) => lesson.class_block_id))];
  const { data: classBlocks, error: classBlocksError } = blockIds.length
    ? await supabase.from('class_blocks').select('id, start_date').in('id', blockIds)
    : { data: [], error: null };
  if (classBlocksError) return NextResponse.json({ error: classBlocksError.message }, { status: 500 });

  const blockStartById = new Map((classBlocks ?? []).map((block) => [block.id, block.start_date]));
  const lessonBySessionId = new Map((assignedLessons ?? [])
    .filter((lesson) => lesson.session_id)
    .map((lesson) => [lesson.session_id as string, lesson]));
  const scheduleUpdates = buildRecurringScheduleUpdates({
    sessions: futureSessions.map((futureSession) => {
      const lesson = lessonBySessionId.get(futureSession.id);
      const blockStart = lesson ? blockStartById.get(lesson.class_block_id) : null;
      return {
        id: futureSession.id,
        dateTime: futureSession.date_time,
        curriculumOrder: lesson
          ? `${blockStart ?? '9999-12-31'}:${String(lesson.order_index).padStart(12, '0')}`
          : null,
      };
    }),
    targetDayIndex: schedule.index,
    targetTime: parsed.data.scheduleTime,
  });

  const updates = scheduleUpdates.map((sessionUpdate) => {
    return supabase.from('sessions').update({ date_time: sessionUpdate.dateTime, zoom_link_snapshot: klass.zoom_link }).eq('id', sessionUpdate.id);
  });
  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  const { error: updateClassError } = await supabase.from('classes').update({ schedule_day: parsed.data.scheduleDay.trim().toUpperCase(), schedule_time: normalizeTime(parsed.data.scheduleTime) }).eq('id', classId);
  if (updateClassError) return NextResponse.json({ error: updateClassError.message }, { status: 500 });

  try {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('coder_id')
      .eq('class_id', classId)
      .eq('status', 'ACTIVE');
    const scheduleLabel = `${parsed.data.scheduleDay.trim().toUpperCase()}, pukul ${parsed.data.scheduleTime.slice(0, 5)} WIB`;
    const changeKey = `schedule-${classId}-${Date.now()}`;
    const notificationTasks: Array<Promise<void>> = [];
    if (klass.coach_id) {
      notificationTasks.push(createNotification(
        klass.coach_id,
        'Jadwal kelas diperbarui',
        `Jadwal tetap ${klass.name} berubah menjadi ${scheduleLabel}. Semua sesi mendatang sudah disesuaikan.`,
        'SCHEDULE_CHANGED',
        {
          actionUrl: `/coach/classes/${classId}`,
          category: 'SCHEDULE',
          priority: 'HIGH',
          dedupeKey: `${changeKey}-${klass.coach_id}`,
          push: true,
          pushTag: `schedule-${classId}`,
        },
      ));
    }
    for (const enrollment of enrollments ?? []) {
      notificationTasks.push(createNotification(
        enrollment.coder_id,
        'Jadwal kelas diperbarui',
        `Jadwal tetap ${klass.name} berubah menjadi ${scheduleLabel}. Cek dashboard untuk jadwal berikutnya.`,
        'SCHEDULE_CHANGED',
        {
          actionUrl: '/coder/dashboard',
          category: 'SCHEDULE',
          priority: 'HIGH',
          dedupeKey: `${changeKey}-${enrollment.coder_id}`,
          push: true,
          pushTag: `schedule-${classId}`,
        },
      ));
    }
    await Promise.allSettled(notificationTasks);
  } catch (notificationError) {
    console.error('[ClassSchedule] Failed to notify class members', notificationError);
  }

  return NextResponse.json({ success: true, updatedSessions: scheduleUpdates.length });
}
