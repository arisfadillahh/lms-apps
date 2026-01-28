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
  // Handle orderIndex separately below
  // if (updates.orderIndex !== undefined) payload.order_index = updates.orderIndex; 
  if (updates.estimatedMeetingCount !== undefined) {
    payload.estimated_meeting_count = updates.estimatedMeetingCount;
  }
  if (updates.makeUpInstructions !== undefined) payload.make_up_instructions = updates.makeUpInstructions;

  // Handle Reordering with Safe Shift
  if (updates.orderIndex !== undefined) {
    const { data: currentLesson, error: fetchError } = await supabase
      .from('lesson_templates')
      .select('block_id, order_index')
      .eq('id', id)
      .single();

    if (fetchError || !currentLesson) {
      throw new Error(`Failed to fetch lesson for reordering: ${fetchError?.message}`);
    }

    const oldIndex = currentLesson.order_index;
    const newIndex = updates.orderIndex;

    if (newIndex !== oldIndex) {
      // 1. Temp move to -1 to free up the slot
      await supabase.from('lesson_templates').update({ order_index: -1 }).eq('id', id);

      if (newIndex > oldIndex) {
        // Shift Down (e.g. 1 -> 3). Others (2,3) -> (1,2)
        // Shift range: (oldIndex, newIndex]
        const { data: toShift } = await supabase
          .from('lesson_templates')
          .select('id, order_index')
          .eq('block_id', currentLesson.block_id)
          .gt('order_index', oldIndex)
          .lte('order_index', newIndex)
          .order('order_index', { ascending: true }); // Process 2 then 3

        if (toShift) {
          for (const item of toShift) {
            await supabase
              .from('lesson_templates')
              .update({ order_index: item.order_index - 1 })
              .eq('id', item.id);
          }
        }
      } else {
        // Shift Up (e.g. 3 -> 1). Others (1,2) -> (2,3)
        // Shift range: [newIndex, oldIndex)
        const { data: toShift } = await supabase
          .from('lesson_templates')
          .select('id, order_index')
          .eq('block_id', currentLesson.block_id)
          .gte('order_index', newIndex)
          .lt('order_index', oldIndex)
          .order('order_index', { ascending: false }); // Process 2 then 1

        if (toShift) {
          for (const item of toShift) {
            await supabase
              .from('lesson_templates')
              .update({ order_index: item.order_index + 1 })
              .eq('id', item.id);
          }
        }
      }
      // Finally set the new index in the payload
      payload.order_index = newIndex;
    }
  }

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
