"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { Json, TablesInsert, TablesRow, TablesUpdate } from '@/types/supabase';

export type MakeUpTaskRecord = TablesRow<'make_up_tasks'>;

export async function getMakeUpTaskById(id: string): Promise<MakeUpTaskRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('make_up_tasks').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch make-up task: ${error.message}`);
  }

  return data;
}

export async function listMakeUpTasksByCoder(coderId: string): Promise<MakeUpTaskRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('make_up_tasks')
    .select('*')
    .eq('coder_id', coderId)
    .order('due_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to list make-up tasks: ${error.message}`);
  }

  return data ?? [];
}

export type UpdateMakeUpSubmissionInput = {
  taskId: string;
  submissionFiles: Json;
  submittedAtIso: string;
};

export async function submitMakeUpTask({ taskId, submissionFiles, submittedAtIso }: UpdateMakeUpSubmissionInput): Promise<void> {
  const supabase = getSupabaseAdmin();
  const payload: TablesUpdate<'make_up_tasks'> = {
    submission_files: submissionFiles,
    submitted_at: submittedAtIso,
    status: 'SUBMITTED',
  };

  const { error } = await supabase.from('make_up_tasks').update(payload).eq('id', taskId);

  if (error) {
    throw new Error(`Failed to submit make-up task: ${error.message}`);
  }
}

export type ReviewMakeUpInput = {
  taskId: string;
  reviewedByCoachId: string;
  feedback?: string | null;
  status: MakeUpTaskRecord['status'];
};

export async function reviewMakeUpTask({ taskId, reviewedByCoachId, feedback, status }: ReviewMakeUpInput): Promise<void> {
  const supabase = getSupabaseAdmin();
  const payload: TablesUpdate<'make_up_tasks'> = {
    reviewed_by_coach_id: reviewedByCoachId,
    reviewed_at: new Date().toISOString(),
    feedback: feedback ?? null,
    status,
  };

  const { error } = await supabase.from('make_up_tasks').update(payload).eq('id', taskId);

  if (error) {
    throw new Error(`Failed to review make-up task: ${error.message}`);
  }
}

export async function createMakeUpTask(input: TablesInsert<'make_up_tasks'>): Promise<MakeUpTaskRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('make_up_tasks').insert(input).select('*').single();

  if (error) {
    throw new Error(`Failed to create make-up task: ${error.message}`);
  }

  return data;
}

export async function findPendingMakeUpTasksInWindow(startIso: string, endIso: string): Promise<MakeUpTaskRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('make_up_tasks')
    .select('*')
    .eq('status', 'PENDING_UPLOAD')
    .gte('due_date', startIso)
    .lte('due_date', endIso);

  if (error) {
    throw new Error(`Failed to fetch make-up tasks for reminder: ${error.message}`);
  }

  return data ?? [];
}

export type CoachMakeUpTask = MakeUpTaskRecord & {
  session?: { id: string; class_id: string; date_time: string } | null;
  class?: { id: string; name: string } | null;
  coder?: { id: string; full_name: string } | null;
};

export async function listTasksForCoach(coachId: string): Promise<CoachMakeUpTask[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('make_up_tasks')
    .select(
      `
        *,
        session:sessions!inner(id, class_id, date_time),
        class:classes!sessions_class_id_fkey(id, name, coach_id),
        coder:users!make_up_tasks_coder_id_fkey(id, full_name)
      `,
    )
    .in('status', ['PENDING_UPLOAD', 'SUBMITTED'])
    .eq('class.coach_id', coachId)
    .order('due_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch coach make-up tasks: ${error.message}`);
  }

  return (data ?? []) as CoachMakeUpTask[];
}
