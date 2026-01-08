"use server";

import { addDays, parseISO } from 'date-fns';

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type {
  TablesInsert,
  TablesRow,
  TablesUpdate,
} from '@/types/supabase';

type AttendanceStatus = TablesRow<'attendance'>['status'];

export type AttendanceRecord = TablesRow<'attendance'>;
export type MakeUpTaskRecord = TablesRow<'make_up_tasks'>;

export type MarkAttendanceInput = {
  sessionId: string;
  coderId: string;
  status: AttendanceStatus;
  reason?: string | null;
  recordedBy: string;
  makeUpDueDate?: string;
  createMakeUpTask?: boolean;
  classLessonId?: string | null;
  instructions?: string | null;
};

export type MarkAttendanceResult = {
  attendance: AttendanceRecord;
  makeUpTask?: MakeUpTaskRecord | null;
};

export async function markAttendance(input: MarkAttendanceInput): Promise<MarkAttendanceResult> {
  const supabase = getSupabaseAdmin();

  const normalizedReason =
    input.status === 'ABSENT' || input.status === 'EXCUSED'
      ? input.reason?.trim() ?? null
      : null;
  const shouldCreateMakeUp =
    (input.status === 'ABSENT' || input.status === 'EXCUSED') &&
    (input.createMakeUpTask ?? true);

  const attendancePayload: TablesInsert<'attendance'> = {
    session_id: input.sessionId,
    coder_id: input.coderId,
    status: input.status,
    reason: normalizedReason,
    recorded_by: input.recordedBy,
    make_up_task_created: shouldCreateMakeUp,
  };

  const { data: attendanceData, error: attendanceError } = await supabase
    .from('attendance')
    .upsert(attendancePayload, { onConflict: 'session_id,coder_id' })
    .select('*')
    .single();

  if (attendanceError || !attendanceData) {
    throw new Error(`Failed to upsert attendance: ${attendanceError?.message ?? 'Unknown error'}`);
  }

  const dueDate = input.makeUpDueDate
    ? parseISO(input.makeUpDueDate)
    : addDays(new Date(attendanceData.recorded_at ?? Date.now()), 7);

  const makeUpPayload: TablesInsert<'make_up_tasks'> = {
    attendance_id: attendanceData.id,
    coder_id: input.coderId,
    session_id: input.sessionId,
    class_lesson_id: input.classLessonId ?? null,
    due_date: dueDate.toISOString(),
    status: 'PENDING_UPLOAD',
    instructions: input.instructions ?? null,
  };

  if (!shouldCreateMakeUp) {
    return { attendance: attendanceData, makeUpTask: null };
  }

  const { data: existingMakeUp, error: existingMakeUpError } = await supabase
    .from('make_up_tasks')
    .select('*')
    .eq('attendance_id', attendanceData.id)
    .maybeSingle();

  if (existingMakeUpError) {
    throw new Error(`Failed to fetch make-up task: ${existingMakeUpError.message}`);
  }

  if (existingMakeUp) {
    const existingDueDate =
      existingMakeUp.due_date ? new Date(existingMakeUp.due_date).toISOString() : null;
    const targetDueDate =
      makeUpPayload.due_date ? new Date(makeUpPayload.due_date).toISOString() : null;
    const needsUpdate =
      existingDueDate !== targetDueDate ||
      (existingMakeUp.class_lesson_id ?? null) !== (makeUpPayload.class_lesson_id ?? null) ||
      (existingMakeUp.instructions ?? null) !== (makeUpPayload.instructions ?? null);

    if (needsUpdate) {
      const { data: updatedMakeUp, error: updateMakeUpError } = await supabase
        .from('make_up_tasks')
        .update({
          due_date: makeUpPayload.due_date,
          class_lesson_id: makeUpPayload.class_lesson_id ?? null,
          instructions: makeUpPayload.instructions ?? null,
        })
        .eq('id', existingMakeUp.id)
        .select('*')
        .single();

      if (updateMakeUpError || !updatedMakeUp) {
        throw new Error(`Failed to update make-up task: ${updateMakeUpError?.message ?? 'Unknown error'}`);
      }

      return { attendance: attendanceData, makeUpTask: updatedMakeUp };
    }

    return { attendance: attendanceData, makeUpTask: existingMakeUp };
  }

  const { data: makeUpData, error: makeUpError } = await supabase
    .from('make_up_tasks')
    .insert(makeUpPayload)
    .select('*')
    .single();

  if (makeUpError) {
    // Attempt to roll back attendance make_up_task_created flag
    await supabase
      .from('attendance')
      .update({ make_up_task_created: false })
      .eq('id', attendanceData.id);

    throw new Error(`Failed to create make-up task: ${makeUpError.message}`);
  }

  return { attendance: attendanceData, makeUpTask: makeUpData };
}

export async function listAttendanceBySession(sessionId: string): Promise<AttendanceRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('session_id', sessionId)
    .order('recorded_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to list attendance: ${error.message}`);
  }

  return data ?? [];
}

export async function listAttendanceByCoder(coderId: string): Promise<AttendanceRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('coder_id', coderId)
    .order('recorded_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list attendance by coder: ${error.message}`);
  }

  return data ?? [];
}

export async function updateMakeUpCreated(attendanceId: string, created: boolean): Promise<void> {
  const supabase = getSupabaseAdmin();
  const payload: TablesUpdate<'attendance'> = { make_up_task_created: created };
  const { error } = await supabase.from('attendance').update(payload).eq('id', attendanceId);

  if (error) {
    throw new Error(`Failed to update make-up flag: ${error.message}`);
  }
}

export async function listAttendanceForSessions(sessionIds: string[]): Promise<AttendanceRecord[]> {
  if (sessionIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .in('session_id', sessionIds);

  if (error) {
    throw new Error(`Failed to list attendance by sessions: ${error.message}`);
  }

  return data ?? [];
}
