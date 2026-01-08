"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { TablesRow } from '@/types/supabase';

export type LevelRecord = TablesRow<'levels'>;

export async function listLevels(): Promise<LevelRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('levels').select('*').order('order_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to list levels: ${error.message}`);
  }

  return data ?? [];
}

export async function getLevelById(id: string): Promise<LevelRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('levels').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch level: ${error.message}`);
  }

  return data;
}

export async function deleteLevel(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('levels').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete level: ${error.message}`);
  }
}
