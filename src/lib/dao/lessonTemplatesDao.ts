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
  estimatedMeetingCount?: number | null;
  makeUpInstructions?: string | null;
};

export type UpdateLessonTemplateInput = Partial<{
  title: string;
  summary: string | null;
  slideUrl: string | null;
  exampleUrl: string | null;
  exampleStoragePath: string | null;
  orderIndex: number;
  estimatedMeetingCount: number | null;
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

  // Shift existing lessons if inserting in the middle
  // We increment order_index for all lessons with order_index >= input.orderIndex
  // Manual iterative shift in JS as RPC is not available in types currently.

  // REVISION: I will implement the iterative shift in JS for now as I cannot reliably execute DDL for RPC.
  // It's not ideal for perf but works for small N (lessons per block < 50 usually).
  const { data: lessonsToShift } = await supabase
    .from('lesson_templates')
    .select('id, order_index')
    .eq('block_id', input.blockId)
    .gte('order_index', input.orderIndex)
    .order('order_index', { ascending: false }); // Highest first to avoid collision

  if (lessonsToShift && lessonsToShift.length > 0) {
    for (const les of lessonsToShift) {
      await supabase
        .from('lesson_templates')
        .update({ order_index: les.order_index + 1 })
        .eq('id', les.id);
    }
  }

  const payload: TablesInsert<'lesson_templates'> = {
    block_id: input.blockId,
    title: input.title,
    summary: input.summary ?? null,
    slide_url: input.slideUrl ?? null,
    order_index: input.orderIndex,
    estimated_meeting_count: input.estimatedMeetingCount ?? null,
    make_up_instructions: input.makeUpInstructions ?? null,
  } as any;

  const { data, error } = await supabase
    .from('lesson_templates')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('Error creating lesson template in DAO:', error);
    throw error; // Re-throw the original PostgrestError to be caught by the route
  }

  return data;
}

export async function updateLessonTemplate(id: string, updates: UpdateLessonTemplateInput): Promise<LessonTemplateRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesUpdate<'lesson_templates'> = {} as any;

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.summary !== undefined) payload.summary = updates.summary;
  if (updates.slideUrl !== undefined) payload.slide_url = updates.slideUrl;
  if (updates.exampleUrl !== undefined) payload.example_url = updates.exampleUrl;
  if (updates.exampleStoragePath !== undefined) payload.example_storage_path = updates.exampleStoragePath;
  if (updates.orderIndex !== undefined) payload.order_index = updates.orderIndex;
  if (updates.estimatedMeetingCount !== undefined) {
    payload.estimated_meeting_count = updates.estimatedMeetingCount;
    // We might want to clear duration_minutes too?
    // payload.duration_minutes = null; // Optional: Enforce migration
  }
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

export async function deleteLessonTemplate(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  // 1. Get the lesson to know block_id and order_index
  const { data: lesson, error: fetchError } = await supabase
    .from('lesson_templates')
    .select('block_id, order_index')
    .eq('id', id)
    .single();

  if (fetchError || !lesson) {
    throw new Error('Lesson not found');
  }

  // 2. Delete the lesson
  const { error: deleteError } = await supabase
    .from('lesson_templates')
    .delete()
    .eq('id', id);

  if (deleteError) {
    throw new Error(`Failed to delete lesson: ${deleteError.message}`);
  }

  // 3. Shift order index for remaining lessons (decrement those > order_index)
  // Logic: "close the gap"
  const { data: lessonsToShift } = await supabase
    .from('lesson_templates')
    .select('id, order_index')
    .eq('block_id', lesson.block_id)
    .gt('order_index', lesson.order_index)
    .order('order_index', { ascending: true }); // Lowest first

  if (lessonsToShift && lessonsToShift.length > 0) {
    for (const les of lessonsToShift) {
      // Decrement order index
      await supabase
        .from('lesson_templates')
        .update({ order_index: les.order_index - 1 })
        .eq('id', les.id);
    }
  }
}
