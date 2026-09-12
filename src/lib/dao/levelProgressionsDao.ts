"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { TablesRow } from '@/types/supabase';

export type LevelProgressionRecord = TablesRow<'coder_level_progressions'>;

export type FinalizeLevelResult = {
  progressionId: string;
  status: LevelProgressionRecord['status'];
  targetLevelId: string | null;
  createdNow: boolean;
};

export async function finalizeCoderLevel(input: {
  coderId: string;
  sourceLevelId: string;
  sourceClassId: string;
}): Promise<FinalizeLevelResult | null> {
  const { data, error } = await (getSupabaseAdmin() as any).rpc('finalize_coder_level', {
    p_coder_id: input.coderId,
    p_source_level_id: input.sourceLevelId,
    p_source_class_id: input.sourceClassId,
  });
  if (error) throw new Error(`Failed to finalize Coder level: ${error.message}`);
  const row = data?.[0];
  if (!row) return null;
  return {
    progressionId: row.progression_id,
    status: row.progression_status,
    targetLevelId: row.target_level_id,
    createdNow: row.created_now,
  };
}

export async function placeCoder(input: {
  progressionId: string;
  targetClassId: string;
  adminId: string;
}): Promise<{ targetEnrollmentId: string; placedNow: boolean }> {
  const { data, error } = await (getSupabaseAdmin() as any).rpc('place_coder_level_progression', {
    p_progression_id: input.progressionId,
    p_target_class_id: input.targetClassId,
    p_admin_id: input.adminId,
  });
  if (error) throw new Error(`Failed to place Coder: ${error.message}`);
  const row = data?.[0];
  if (!row) throw new Error('Placement did not return an enrollment');
  return { targetEnrollmentId: row.target_enrollment_id, placedNow: row.placed_now };
}

export async function getLatestForCoder(coderId: string): Promise<LevelProgressionRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('coder_level_progressions')
    .select('*')
    .eq('coder_id', coderId)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load Coder level status: ${error.message}`);
  return data;
}
