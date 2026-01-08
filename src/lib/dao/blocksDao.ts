"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { TablesInsert, TablesRow, TablesUpdate } from '@/types/supabase';

export type BlockRecord = TablesRow<'blocks'>;
export type ClassBlockRecord = TablesRow<'class_blocks'>;

export type CreateBlockInput = {
  levelId: string;
  name: string;
  summary?: string | null;
  orderIndex: number;
};

export type UpdateBlockInput = Partial<{
  name: string;
  summary: string | null;
  orderIndex: number;
}>;

export async function listBlocksByLevel(levelId: string): Promise<BlockRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('blocks')
    .select('*')
    .eq('level_id', levelId)
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to list blocks: ${error.message}`);
  }

  return data ?? [];
}

export async function getBlockById(id: string): Promise<BlockRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('blocks').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch block: ${error.message}`);
  }

  return data;
}

export async function createBlock(input: CreateBlockInput): Promise<BlockRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesInsert<'blocks'> = {
    level_id: input.levelId,
    name: input.name,
    summary: input.summary ?? null,
    order_index: input.orderIndex,
    estimated_sessions: null,
    is_published: true,
  };

  const { data, error } = await supabase.from('blocks').insert(payload).select('*').single();
  if (error) {
    throw new Error(`Failed to create block: ${error.message}`);
  }

  return data;
}

export async function updateBlock(id: string, updates: UpdateBlockInput): Promise<BlockRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesUpdate<'blocks'> = {};

  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.summary !== undefined) payload.summary = updates.summary;
  if (updates.orderIndex !== undefined) payload.order_index = updates.orderIndex;

  const { data, error } = await supabase.from('blocks').update(payload).eq('id', id).select('*').single();
  if (error) {
    throw new Error(`Failed to update block: ${error.message}`);
  }

  return data;
}

export async function getClassBlocksByStatus(classId: string): Promise<ClassBlockRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('class_blocks')
    .select('*')
    .eq('class_id', classId)
    .order('start_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch class blocks: ${error.message}`);
  }

  return data ?? [];
}
