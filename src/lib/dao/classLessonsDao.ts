"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { TablesInsert, TablesRow, TablesUpdate } from '@/types/supabase';

export type ClassLessonRecord = TablesRow<'class_lessons'>;

export type ClassLessonWithTemplate = ClassLessonRecord & {
  template_title: string;
  template_summary: string | null;
  template_slide_url: string | null;
  template_make_up_instructions: string | null;
  template_estimated_meeting_count: number | null;
};

export async function listLessonsByClassBlock(classBlockId: string): Promise<ClassLessonWithTemplate[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('class_lessons')
    .select(`
      *,
      lesson_templates!inner(
        title,
        summary,
        slide_url,
        make_up_instructions,
        estimated_meeting_count
      )
    `)
    .eq('class_block_id', classBlockId)
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to list class lessons: ${error.message}`);
  }

  // Map the joined data to a flat structure with template_ prefix for clarity
  return (data ?? []).map((row: any) => ({
    ...row,
    // Override with template values (live reference)
    title: row.lesson_templates?.title ?? row.title,
    summary: row.lesson_templates?.summary ?? row.summary,
    slide_url: row.lesson_templates?.slide_url ?? row.slide_url,
    make_up_instructions: row.lesson_templates?.make_up_instructions ?? row.make_up_instructions,
    // Also expose template_ prefixed for explicit access
    template_title: row.lesson_templates?.title ?? null,
    template_summary: row.lesson_templates?.summary ?? null,
    template_slide_url: row.lesson_templates?.slide_url ?? null,
    template_make_up_instructions: row.lesson_templates?.make_up_instructions ?? null,
    template_estimated_meeting_count: row.lesson_templates?.estimated_meeting_count ?? null,
  }));
}

export async function createClassLessons(
  inputs: TablesInsert<'class_lessons'>[],
): Promise<ClassLessonRecord[]> {
  if (inputs.length === 0) {
    return [];
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('class_lessons')
    .insert(inputs)
    .select('*');

  if (error) {
    throw new Error(`Failed to create class lessons: ${error.message}`);
  }

  return data ?? [];
}

export async function getClassLessonById(id: string): Promise<ClassLessonRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('class_lessons')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch class lesson: ${error.message}`);
  }

  return data;
}

export async function getClassLessonBySession(sessionId: string): Promise<ClassLessonRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('class_lessons')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch class lesson: ${error.message}`);
  }

  return data;
}

export async function assignLessonToSession(classLessonId: string, sessionId: string, unlockAtIso?: string | null): Promise<void> {
  const supabase = getSupabaseAdmin();
  const payload: TablesUpdate<'class_lessons'> = {
    session_id: sessionId,
  };
  if (unlockAtIso !== undefined) {
    payload.unlock_at = unlockAtIso;
  }

  const { error } = await supabase
    .from('class_lessons')
    .update(payload)
    .eq('id', classLessonId);

  if (error) {
    throw new Error(`Failed to assign session to class lesson: ${error.message}`);
  }
}

export async function clearLessonSession(classLessonId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('class_lessons')
    .update({ session_id: null, unlock_at: null })
    .eq('id', classLessonId);

  if (error) {
    throw new Error(`Failed to clear session from lesson: ${error.message}`);
  }
}
export async function updateLessonExample(lessonId: string, url: string | null, storagePath: string | null): Promise<void> {
  const supabase = getSupabaseAdmin();
  const payload: TablesUpdate<'class_lessons'> = {
    coach_example_url: url,
    coach_example_storage_path: storagePath,
  };

  const { error } = await supabase
    .from('class_lessons')
    .update(payload)
    .eq('id', lessonId);

  if (error) {
    throw new Error(`Failed to update coach example: ${error.message}`);
  }
}

export async function syncTemplateLessonExample(
  lessonTemplateId: string,
  url: string | null,
  storagePath: string | null,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const payload: TablesUpdate<'class_lessons'> = {
    coach_example_url: url,
    coach_example_storage_path: storagePath,
  };

  const { error } = await supabase
    .from('class_lessons')
    .update(payload)
    .eq('lesson_template_id', lessonTemplateId);

  if (error) {
    throw new Error(`Failed to sync template lesson examples: ${error.message}`);
  }
}

export async function deleteClassLesson(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('class_lessons').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete class lesson: ${error.message}`);
  }
}

export async function syncTemplateLessonSlide(lessonTemplateId: string, slideUrl: string | null): Promise<void> {
  const supabase = getSupabaseAdmin();
  const payload: TablesUpdate<'class_lessons'> = {
    slide_url: slideUrl,
  };

  const { error } = await supabase
    .from('class_lessons')
    .update(payload)
    .eq('lesson_template_id', lessonTemplateId);

  if (error) {
    throw new Error(`Failed to sync template lesson slide: ${error.message}`);
  }
}

export async function unassignLessonsFromSessions(sessionIds: string[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('class_lessons')
    .update({ session_id: null, unlock_at: null })
    .in('session_id', sessionIds);

  if (error) {
    throw new Error(`Failed to unassign lessons from sessions: ${error.message}`);
  }
}
