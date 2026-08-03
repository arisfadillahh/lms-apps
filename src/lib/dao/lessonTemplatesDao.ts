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

export async function listLessonsByBlock(
  blockId: string,
  options: { includeArchived?: boolean } = {},
): Promise<LessonTemplateRecord[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('lesson_templates')
    .select('*')
    .eq('block_id', blockId);

  if (!options.includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query.order('order_index', { ascending: true });

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
    .eq('is_archived', false)
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
      // 1. Temp move to a high number to free up the slot.
      // Use 9000 + oldIndex to avoid collision with normal range (assuming lessons < 9000)
      // and checking error to ensure it actually happened.
      const tempIndex = 9000 + oldIndex;
      const { error: tempError } = await supabase
        .from('lesson_templates')
        .update({ order_index: tempIndex })
        .eq('id', id);

      if (tempError) {
        throw new Error(`Failed to move lesson to temp index: ${tempError.message}`);
      }

      if (newIndex > oldIndex) {
        // Shift Down (e.g. 1 -> 3). Others (2,3) -> (1,2)
        // Shift range: (oldIndex, newIndex]
        const { data: toShift } = await supabase
          .from('lesson_templates')
          .select('id, order_index')
          .eq('block_id', currentLesson.block_id)
          .eq('is_archived', false)
          .gt('order_index', oldIndex)
          .lte('order_index', newIndex)
          .order('order_index', { ascending: true }); // Process 2 then 3

        if (toShift) {
          for (const item of toShift) {
            const { error: shiftError } = await supabase
              .from('lesson_templates')
              .update({ order_index: item.order_index - 1 })
              .eq('id', item.id);

            if (shiftError) {
              // Try to rollback? Ideally yes, but for now throw to stop.
              throw new Error(`Failed to shift lesson ${item.id}: ${shiftError.message}`);
            }
          }
        }
      } else {
        // Shift Up (e.g. 3 -> 1). Others (1,2) -> (2,3)
        // Shift range: [newIndex, oldIndex)
        const { data: toShift } = await supabase
          .from('lesson_templates')
          .select('id, order_index')
          .eq('block_id', currentLesson.block_id)
          .eq('is_archived', false)
          .gte('order_index', newIndex)
          .lt('order_index', oldIndex)
          .order('order_index', { ascending: false }); // Process 2 then 1

        if (toShift) {
          for (const item of toShift) {
            const { error: shiftError } = await supabase
              .from('lesson_templates')
              .update({ order_index: item.order_index + 1 })
              .eq('id', item.id);

            if (shiftError) {
              throw new Error(`Failed to shift lesson ${item.id}: ${shiftError.message}`);
            }
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
  await archiveLessonTemplate(id);
}

export async function archiveLessonTemplate(id: string): Promise<LessonTemplateRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('lesson_templates')
    .update({ is_archived: true, archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('is_archived', false)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to archive lesson: ${error.message}`);
  }

  if (data) return data;

  const existing = await getLessonTemplateById(id);
  if (!existing) throw new Error('Lesson not found');
  return existing;
}

export async function restoreLessonTemplate(id: string): Promise<LessonTemplateRecord> {
  const supabase = getSupabaseAdmin();
  const lesson = await getLessonTemplateById(id);
  if (!lesson) throw new Error('Lesson not found');
  if (!lesson.is_archived) return lesson;

  const { data: collision } = await supabase
    .from('lesson_templates')
    .select('id')
    .eq('block_id', lesson.block_id)
    .eq('order_index', lesson.order_index)
    .eq('is_archived', false)
    .neq('id', lesson.id)
    .maybeSingle();

  let targetOrder = lesson.order_index;
  if (collision) {
    const { data: activeLessons } = await supabase
      .from('lesson_templates')
      .select('order_index')
      .eq('block_id', lesson.block_id)
      .eq('is_archived', false)
      .order('order_index', { ascending: false })
      .limit(1);
    targetOrder = (activeLessons?.[0]?.order_index ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from('lesson_templates')
    .update({
      is_archived: false,
      archived_at: null,
      order_index: targetOrder,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to restore lesson: ${error.message}`);
  }

  return data;
}

export async function deleteLessonTemplatesBulk(ids: string[]): Promise<void> {
  for (const id of ids) {
    await archiveLessonTemplate(id);
  }
}


export type BulkUpdateLessonInput = {
  id: string;
  title: string;
  summary?: string | null;
  slideUrl?: string | null;
  makeUpInstructions?: string | null;
  estimatedMeetingCount?: number | null;
  orderIndex: number;
};

export async function updateLessonTemplatesBulk(updates: BulkUpdateLessonInput[]): Promise<void> {
  if (updates.length === 0) return;

  const supabase = getSupabaseAdmin();

  // We use a transaction-like approach by updating each record.
  // Ideally this would be a single RPC or transaction, but via REST we iterate.
  // Since we are setting exact order_indexes, we don't need complex shifting logic here
  // assuming the client sends a complete, conflict-free set of indexes for the block.

  /* 
    Transaction-less update strategy to avoid unique constraint violations on reordering.
    We assume client sends a full reorder set for the block. 
    1. Temporarily shift all affected items to a "safe zone" (e.g., target + 9000).
    2. Update to final targets.
  */

  // 1. Shift to temporary indices to clear the target slots
  for (const update of updates) {
    const tempIndex = update.orderIndex + 9000;
    const { error } = await supabase
      .from('lesson_templates')
      .update({ order_index: tempIndex })
      .eq('id', update.id);

    if (error) {
      // If this fails (e.g. collision at 9000), we abort.
      // Ideally we'd rollback but we can't easily without RPC.
      console.error(`Failed to park lesson ${update.id} at temp index:`, error);
      throw new Error(`Failed to reorder lesson (step 1): ${error.message}`);
    }
  }

  // 2. Main update loop (final state)
  for (const update of updates) {
    const payload: TablesUpdate<'lesson_templates'> = {
      title: update.title,
      summary: update.summary ?? null,
      slide_url: update.slideUrl ?? null,
      make_up_instructions: update.makeUpInstructions ?? null,
      estimated_meeting_count: update.estimatedMeetingCount ?? null, // Can accept 0 now as valid thanks to calling code fix
      order_index: update.orderIndex,
    };

    const { error } = await supabase
      .from('lesson_templates')
      .update(payload)
      .eq('id', update.id);

    if (error) {
      console.error(`Failed to update lesson ${update.id} in bulk (step 2):`, error);
      throw new Error(`Failed to update lesson ${update.title}: ${error.message}`);
    }
  }
}
