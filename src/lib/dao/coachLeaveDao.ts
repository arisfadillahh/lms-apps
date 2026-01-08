"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { TablesInsert, TablesRow, TablesUpdate } from '@/types/supabase';

export type CoachLeaveRequestRecord = TablesRow<'coach_leave_requests'>;

export type CoachLeaveRequestWithRelations = CoachLeaveRequestRecord & {
  coach?: { id: string; full_name: string } | null;
  session?: { id: string; date_time: string; class_id: string } | null;
  class?: { id: string; name: string } | null;
  substitute?: { id: string; full_name: string } | null;
};

export type CreateLeaveRequestInput = {
  coachId: string;
  sessionId: string;
  note?: string | null;
};

export async function createLeaveRequest({ coachId, sessionId, note }: CreateLeaveRequestInput): Promise<CoachLeaveRequestRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesInsert<'coach_leave_requests'> = {
    coach_id: coachId,
    session_id: sessionId,
    note: note ?? null,
  };

  const { data, error } = await supabase
    .from('coach_leave_requests')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    if ((error as any)?.code === '23505') {
      throw new Error('Leave request already exists for this session');
    }
    throw new Error(`Failed to create leave request: ${error.message}`);
  }

  return data;
}

export async function listLeaveRequestsForCoach(coachId: string): Promise<CoachLeaveRequestWithRelations[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('coach_leave_requests')
    .select(
      `
        *,
        session:sessions (id, date_time, class_id, classes:classes (id, name)),
        substitute:users!coach_leave_requests_substitute_coach_id_fkey (id, full_name)
      `,
    )
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list leave requests: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    ...(row as CoachLeaveRequestRecord),
    session: row.session
      ? {
          id: row.session.id,
          date_time: row.session.date_time,
          class_id: row.session.class_id,
        }
      : null,
    class: row.session?.classes ? { id: row.session.classes.id, name: row.session.classes.name } : null,
    substitute: row.substitute ?? null,
  }));
}

export async function listLeaveRequestsWithCoach(): Promise<CoachLeaveRequestWithRelations[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('coach_leave_requests')
    .select(
      `
        *,
        coach:users!coach_leave_requests_coach_id_fkey (id, full_name),
        session:sessions (id, date_time, class_id, classes:classes (id, name)),
        substitute:users!coach_leave_requests_substitute_coach_id_fkey (id, full_name)
      `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list leave requests: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    ...(row as CoachLeaveRequestRecord),
    coach: row.coach ?? null,
    session: row.session
      ? {
          id: row.session.id,
          date_time: row.session.date_time,
          class_id: row.session.class_id,
        }
      : null,
    class: row.session?.classes ? { id: row.session.classes.id, name: row.session.classes.name } : null,
    substitute: row.substitute ?? null,
  }));
}

export type UpdateLeaveRequestInput = {
  status: CoachLeaveRequestRecord['status'];
  substituteCoachId?: string | null;
  approvedBy: string;
};

export async function updateLeaveRequest(id: string, input: UpdateLeaveRequestInput): Promise<CoachLeaveRequestRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesUpdate<'coach_leave_requests'> = {
    status: input.status,
    substitute_coach_id: input.substituteCoachId ?? null,
    approved_by: input.approvedBy,
    approved_at: input.status === 'APPROVED' || input.status === 'REJECTED' ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from('coach_leave_requests')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to update leave request: ${error?.message ?? 'Unknown error'}`);
  }

  return data;
}

export async function getLeaveRequestById(id: string): Promise<CoachLeaveRequestRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('coach_leave_requests').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch leave request: ${error.message}`);
  }

  return data;
}
