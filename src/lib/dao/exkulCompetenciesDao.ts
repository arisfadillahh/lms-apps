"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { TablesInsert, TablesRow, TablesUpdate } from '@/types/supabase';

export type ExkulCompetencyRecord = TablesRow<'exkul_session_competencies'>;

export async function getBySession(sessionId: string): Promise<ExkulCompetencyRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('exkul_session_competencies')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch ekskul competencies: ${error.message}`);
  }

  return data;
}

export async function upsertCompetencies(sessionId: string, competencies: TablesRow<'exkul_session_competencies'>['competencies']): Promise<ExkulCompetencyRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesInsert<'exkul_session_competencies'> = {
    session_id: sessionId,
    competencies,
  };

  const { data, error } = await supabase
    .from('exkul_session_competencies')
    .upsert(payload, { onConflict: 'session_id' })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to upsert ekskul competencies: ${error.message}`);
  }

  return data;
}

export async function deleteCompetencies(sessionId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('exkul_session_competencies')
    .delete()
    .eq('session_id', sessionId);

  if (error) {
    throw new Error(`Failed to delete ekskul competencies: ${error.message}`);
  }
}

export async function listBySessionIds(sessionIds: string[]): Promise<Record<string, ExkulCompetencyRecord>> {
  if (sessionIds.length === 0) {
    return {};
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('exkul_session_competencies')
    .select('*')
    .in('session_id', sessionIds);

  if (error) {
    throw new Error(`Failed to fetch ekskul competencies: ${error.message}`);
  }

  const map: Record<string, ExkulCompetencyRecord> = {};
  (data ?? []).forEach((row) => {
    map[row.session_id] = row;
  });
  return map;
}
