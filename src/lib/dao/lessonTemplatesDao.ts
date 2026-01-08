"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { TablesInsert, TablesRow, TablesUpdate } from '@/types/supabase';

export type LessonTemplateRecord = TablesRow<'lesson_templates'>;

export type CreateLessonTemplateInput = {
  blockId: string;
  title: string;
  summary?: string | null;
  slideUrl?: string | null;
  exampleUrl?: string | null;
  exampleStoragePath?: string | null;
  orderIndex: number;
  durationMinutes?: number | null;
  makeUpInstructions?: string | null;
};

export type UpdateLessonTemplateInput = Partial<{
  title: string;
  summary: string | null;
  slideUrl: string | null;
  exampleUrl: string | null;
  exampleStoragePath: string | null;
  orderIndex: number;
  durationMinutes: number | null;
  makeUpInstructions: string | null;
}>;

export async function getLessonTemplateById(id: string): Promise<LessonTemplateRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('lesson_templates').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch lesson template: ${error.message}`);
  }

  return data;
}

export async function listLessonsByBlock(blockId: string): Promise<LessonTemplateRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('lesson_templates')
    .select('*')
    .eq('block_id', blockId)
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to list lesson templates: ${error.message}`);
  }

  return data ?? [];
}

export async function createLessonTemplate(input: CreateLessonTemplateInput): Promise<LessonTemplateRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesInsert<'lesson_templates'> = {
    block_id: input.blockId,
    title: input.title,
    summary: input.summary ?? null,
    slide_url: input.slideUrl ?? null,
    example_url: input.exampleUrl ?? null,
    example_storage_path: input.exampleStoragePath ?? null,
    order_index: input.orderIndex,
    duration_minutes: input.durationMinutes ?? null,
    make_up_instructions: input.makeUpInstructions ?? null,
  };

  const { data, error } = await supabase
    .from('lesson_templates')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create lesson template: ${error.message}`);
  }

  return data;
}

export async function updateLessonTemplate(id: string, updates: UpdateLessonTemplateInput): Promise<LessonTemplateRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesUpdate<'lesson_templates'> = {};

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.summary !== undefined) payload.summary = updates.summary;
  if (updates.slideUrl !== undefined) payload.slide_url = updates.slideUrl;
  if (updates.exampleUrl !== undefined) payload.example_url = updates.exampleUrl;
  if (updates.exampleStoragePath !== undefined) payload.example_storage_path = updates.exampleStoragePath;
  if (updates.orderIndex !== undefined) payload.order_index = updates.orderIndex;
  if (updates.durationMinutes !== undefined) payload.duration_minutes = updates.durationMinutes;
  if (updates.makeUpInstructions !== undefined) payload.make_up_instructions = updates.makeUpInstructions;

  const { data, error } = await supabase
    .from('lesson_templates')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update lesson template: ${error.message}`);
  }

  return data;
}
