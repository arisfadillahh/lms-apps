"use server";

import { addDays, isAfter, parseISO } from 'date-fns';

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { TablesInsert, TablesRow, TablesUpdate } from '@/types/supabase';
import { getClassById } from '@/lib/dao/classesDao';

export type SessionRecord = TablesRow<'sessions'>;

const WEEKDAY_CODES: Record<number, string> = {
  0: 'SU',
  1: 'MO',
  2: 'TU',
  3: 'WE',
  4: 'TH',
  5: 'FR',
  6: 'SA',
};

function toWeekdayCode(date: Date): string {
  return WEEKDAY_CODES[date.getDay()];
}

function combineDateWithTime(date: Date, time: string): string {
  const [hours, minutes] = time.split(':').map((value) => Number(value));
  const combined = new Date(date);
  combined.setHours(hours, minutes ?? 0, 0, 0);
  return combined.toISOString();
}

export type GenerateSessionsInput = {
  classId: string;
  startDate: string;
  endDate: string;
  byDay: string[];
  time: string;
  zoomLinkSnapshot?: string | null;
};

export async function generateSessions({
  classId,
  startDate,
  endDate,
  byDay,
  time,
  zoomLinkSnapshot,
}: GenerateSessionsInput): Promise<SessionRecord[]> {
  const classRecord = await getClassById(classId);
  if (!classRecord) {
    throw new Error('Class not found');
  }

  const supabase = getSupabaseAdmin();
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const allowedDays = new Set(byDay.map((code) => code.toUpperCase()));

  if (isAfter(start, end)) {
    throw new Error('startDate cannot be after endDate');
  }

  const inserts: TablesInsert<'sessions'>[] = [];
  let cursor = start;
  while (!isAfter(cursor, end)) {
    if (allowedDays.has(toWeekdayCode(cursor))) {
      inserts.push({
        class_id: classId,
        date_time: combineDateWithTime(cursor, time),
        zoom_link_snapshot: zoomLinkSnapshot ?? classRecord.zoom_link,
        status: 'SCHEDULED',
      });
    }
    cursor = addDays(cursor, 1);
  }

  if (inserts.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from('sessions').insert(inserts).select('*');

  if (error) {
    throw new Error(`Failed to generate sessions: ${error.message}`);
  }

  return data ?? [];
}

export async function getSessionById(sessionId: string): Promise<SessionRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch session: ${error.message}`);
  }

  return data;
}

export async function listSessionsByClass(classId: string): Promise<SessionRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('class_id', classId)
    .order('date_time', { ascending: true });

  if (error) {
    throw new Error(`Failed to list sessions: ${error.message}`);
  }

  return data ?? [];
}

export type CoachSessionRow = SessionRecord & {
  class_name?: string;
};

export async function listUpcomingSessionsForCoach(coachId: string, daysAhead = 30): Promise<CoachSessionRow[]> {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('sessions')
    .select('*, classes:classes!inner(id, name, coach_id)')
    .gte('date_time', now.toISOString())
    .lte('date_time', end.toISOString())
    .eq('classes.coach_id', coachId)
    .order('date_time', { ascending: true });

  if (error) {
    throw new Error(`Failed to list upcoming sessions: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    ...(row as SessionRecord),
    class_name: row.classes?.name ?? undefined,
  }));
}

export async function assignSubstituteCoach(sessionId: string, substituteCoachId: string | null): Promise<void> {
  const supabase = getSupabaseAdmin();
  const payload: TablesUpdate<'sessions'> = {
    substitute_coach_id: substituteCoachId,
  };

  const { error } = await supabase.from('sessions').update(payload).eq('id', sessionId);

  if (error) {
    throw new Error(`Failed to assign substitute coach: ${error.message}`);
  }
}

export async function updateSessionStatus(sessionId: string, status: SessionRecord['status']): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('sessions').update({ status }).eq('id', sessionId);

  if (error) {
    throw new Error(`Failed to update session status: ${error.message}`);
  }
}
