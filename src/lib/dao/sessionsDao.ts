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

import { DAY_CODE_MAP } from '@/lib/constants/scheduleConstants';

function toWeekdayCode(date: Date): string {
  return WEEKDAY_CODES[date.getDay()];
}

function combineDateWithTime(date: Date, time: string): string {
  // Manual text construction to verify +07:00 (WIB)
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  // time is expected to be HH:mm or HH:mm:ss
  // We take the first 5 chars for HH:mm and append :00 if needed
  const timePart = time.length === 5 ? `${time}:00` : time;

  return `${yyyy}-${mm}-${dd}T${timePart}+07:00`;
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

export async function listSubstituteSessionsForCoach(classId: string, coachId: string): Promise<SessionRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('class_id', classId)
    .eq('substitute_coach_id', coachId)
    .order('date_time', { ascending: true });

  if (error) {
    throw new Error(`Failed to list substitute sessions: ${error.message}`);
  }

  return data ?? [];
}

export async function listAllSubstituteSessions(coachId: string): Promise<CoachSessionRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sessions')
    .select('*, classes:classes!inner(id, name, coach_id)')
    .eq('substitute_coach_id', coachId)
    .gt('date_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Recent & Future
    .order('date_time', { ascending: true });

  if (error) {
    throw new Error(`Failed to list all substitute sessions: ${error.message}`);
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

export async function updateSession(sessionId: string, payload: TablesUpdate<'sessions'>): Promise<SessionRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('sessions').update(payload).eq('id', sessionId).select().single();

  if (error) {
    throw new Error(`Failed to update session: ${error.message}`);
  }

  return data;
}

/**
 * Automatically update past sessions that are still SCHEDULED to COMPLETED.
 * This should be called by a cron job to mark sessions as completed after their time has passed.
 * Uses WIB timezone for consistency.
 */
export async function autoCompletePastSessions(classId?: string): Promise<{ updated: number; sessionIds: string[] }> {
  const supabase = getSupabaseAdmin();

  // Get current time in WIB
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
  const nowWibStr = `${find('year')}-${find('month')}-${find('day')}T${find('hour')}:${find('minute')}:00+07:00`;

  console.log(`[AutoComplete] Checking for expired sessions before ${nowWibStr}`);

  // Build query for SCHEDULED sessions that have passed
  let query = supabase
    .from('sessions')
    .select('id, date_time, class_id')
    .eq('status', 'SCHEDULED')
    .lt('date_time', nowWibStr);

  // Optionally filter by class
  if (classId) {
    query = query.eq('class_id', classId);
  }

  const { data: expiredSessions, error: fetchError } = await query;

  if (fetchError) {
    console.error('[AutoComplete] Error fetching sessions:', fetchError);
    return { updated: 0, sessionIds: [] };
  }

  if (!expiredSessions || expiredSessions.length === 0) {
    console.log('[AutoComplete] No expired sessions found');
    return { updated: 0, sessionIds: [] };
  }

  console.log(`[AutoComplete] Found ${expiredSessions.length} expired sessions to complete`);

  // Update all expired sessions to COMPLETED
  const sessionIds = expiredSessions.map(s => s.id);

  const { error: updateError } = await supabase
    .from('sessions')
    .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
    .in('id', sessionIds);

  if (updateError) {
    console.error('[AutoComplete] Error updating sessions:', updateError);
    return { updated: 0, sessionIds: [] };
  }

  console.log(`[AutoComplete] Successfully completed ${sessionIds.length} sessions`);
  return { updated: sessionIds.length, sessionIds };
}

function normalizeScheduleDay(scheduleDay: string) {
  const normalized = scheduleDay.trim().toUpperCase();
  return DAY_CODE_MAP[normalized] ?? null;
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

/**
 * Ensures that there are sessions generated for at least `weeksAhead` weeks from now.
 * This effectively implements "Rolling Sessions".
 */
export async function ensureFutureSessions(classId: string, weeksAhead = 12): Promise<number> {
  const supabase = getSupabaseAdmin();
  const classRecord = await getClassById(classId);
  if (!classRecord) return 0;

  // 1. Determine target end date (now + weeksAhead)
  const now = new Date();
  const targetDate = addDays(now, weeksAhead * 7);

  // 2. Fetch the last scheduled session
  const { data: lastSession } = await supabase
    .from('sessions')
    .select('date_time')
    .eq('class_id', classId)
    .order('date_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  let startDate: Date;
  if (lastSession) {
    const lastDate = parseISO(lastSession.date_time);
    if (isAfter(lastDate, targetDate)) {
      // We already have enough sessions
      return 0;
    }
    // Start generating from the week AFTER the last session
    startDate = addDays(lastDate, 7); // Rough jump, logic below will align
  } else {
    // No sessions at all? Start from class start_date or now
    const classStart = new Date(classRecord.start_date);
    startDate = isAfter(classStart, now) ? classStart : now;
  }

  // 3. Prepare parameters for generation
  const scheduleInfo = normalizeScheduleDay(classRecord.schedule_day);
  if (!scheduleInfo) {
    console.warn(`[ensureFutureSessions] Invalid schedule day for class ${classId}: ${classRecord.schedule_day}`);
    return 0;
  }

  // Align startDate to the correct weekday
  const alignedStartDate = alignDateToWeekday(startDate, scheduleInfo.index);

  // If aligned start date is already beyond target, stop.
  if (isAfter(alignedStartDate, targetDate)) {
    return 0;
  }

  // 4. Generate sessions from alignedStartDate to targetDate
  // generateSessions expects string dates
  const newSessions = await generateSessions({
    classId: classRecord.id,
    startDate: toDateOnly(alignedStartDate),
    endDate: toDateOnly(targetDate),
    byDay: [scheduleInfo.code],
    time: classRecord.schedule_time,
  });

  // NOTE: We intentionally do NOT call reassignLessonsToSessions here.
  // That call was causing all manual "Ubah Materi" shifts to be reset on every page load.
  // The rebalancer is still triggered from session cancel/reschedule events when truly needed.

  return newSessions.length;
}
