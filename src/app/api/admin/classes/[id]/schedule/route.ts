import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { DAY_CODE_MAP } from '@/lib/constants/scheduleConstants';

const schema = z.object({
  scheduleDay: z.string().min(2),
  scheduleTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

function toWibDate(date: Date, time: string) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${normalizeTime(time)}+07:00`;
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
  const { data: klass, error: classError } = await supabase.from('classes').select('id, schedule_day, schedule_time, zoom_link').eq('id', classId).maybeSingle();
  if (classError) return NextResponse.json({ error: classError.message }, { status: 500 });
  if (!klass) return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });

  const { data: sessions, error: sessionsError } = await supabase.from('sessions').select('id, date_time, status').eq('class_id', classId).order('date_time', { ascending: true });
  if (sessionsError) return NextResponse.json({ error: sessionsError.message }, { status: 500 });

  const futureSessions = (sessions ?? []).filter((session) => session.status === 'SCHEDULED' && new Date(session.date_time).getTime() > Date.now());
  const updates = futureSessions.map((session) => {
    const date = new Date(session.date_time);
    const currentDay = date.getUTCDay();
    const delta = schedule.index - currentDay;
    date.setUTCDate(date.getUTCDate() + delta);
    return supabase.from('sessions').update({ date_time: toWibDate(date, parsed.data.scheduleTime), zoom_link_snapshot: klass.zoom_link }).eq('id', session.id);
  });
  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  const { error: updateClassError } = await supabase.from('classes').update({ schedule_day: parsed.data.scheduleDay.trim().toUpperCase(), schedule_time: normalizeTime(parsed.data.scheduleTime) }).eq('id', classId);
  if (updateClassError) return NextResponse.json({ error: updateClassError.message }, { status: 500 });

  return NextResponse.json({ success: true, updatedSessions: futureSessions.length });
}
