"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type {
  TablesInsert,
  TablesRow,
  TablesUpdate,
} from '@/types/supabase';

export type ClassRecord = TablesRow<'classes'>;
export type ClassBlockRecord = TablesRow<'class_blocks'>;
export type EnrollmentRecord = TablesRow<'enrollments'>;

export type CreateClassBlockInput = {
  classId: string;
  blockId: string;
  startDate: string;
  endDate: string;
  pitchingDayDate?: string | null;
  status?: ClassBlockRecord['status'];
};

export type CreateClassInput = {
  name: string;
  type: ClassRecord['type'];
  levelId?: string | null;
  ekskulLessonPlanId?: string | null;
  coachId: string;
  scheduleDay: string;
  scheduleTime: string;
  zoomLink: string;
  startDate: string;
  endDate?: string;
};

export async function createClass(input: CreateClassInput): Promise<ClassRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesInsert<'classes'> = {
    name: input.name,
    type: input.type,
    level_id: input.levelId ?? null,
    ekskul_lesson_plan_id: input.ekskulLessonPlanId ?? null,
    coach_id: input.coachId,
    schedule_day: input.scheduleDay,
    schedule_time: input.scheduleTime,
    zoom_link: input.zoomLink,
    start_date: input.startDate,
    end_date: input.endDate ?? input.startDate,
  };

  const { data, error } = await supabase.from('classes').insert(payload).select('*').single();

  if (error) {
    throw new Error(`Failed to create class: ${error.message}`);
  }

  return data;
}

export async function updateClass(id: string, updates: Partial<Omit<CreateClassInput, 'coachId' | 'type'>> & { coachId?: string; type?: ClassRecord['type'] }): Promise<void> {
  const supabase = getSupabaseAdmin();
  const payload: TablesUpdate<'classes'> = {};

  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.type !== undefined) payload.type = updates.type;
  if (updates.levelId !== undefined) payload.level_id = updates.levelId;
  if (updates.coachId !== undefined) payload.coach_id = updates.coachId;
  if (updates.scheduleDay !== undefined) payload.schedule_day = updates.scheduleDay;
  if (updates.scheduleTime !== undefined) payload.schedule_time = updates.scheduleTime;
  if (updates.zoomLink !== undefined) payload.zoom_link = updates.zoomLink;
  if (updates.startDate !== undefined) payload.start_date = updates.startDate;
  if (updates.endDate !== undefined) payload.end_date = updates.endDate;

  if (Object.keys(payload).length === 0) {
    return;
  }

  const { error } = await supabase.from('classes').update(payload).eq('id', id);

  if (error) {
    throw new Error(`Failed to update class: ${error.message}`);
  }
}

export async function getClassById(id: string): Promise<ClassRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('classes').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch class: ${error.message}`);
  }

  return data;
}

export async function listClasses(): Promise<ClassRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('classes').select('*').order('start_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to list classes: ${error.message}`);
  }

  return data ?? [];
}

type ClassBlockQueryRow = ClassBlockRecord & {
  blocks?: {
    name?: string | null;
    order_index?: number | null;
    estimated_sessions?: number | null;
  } | null;
};

export async function getClassBlocks(
  classId: string,
): Promise<
  Array<
    ClassBlockRecord & {
      block_name?: string;
      block_order_index?: number | null;
      block_estimated_sessions?: number | null;
    }
  >
> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('class_blocks')
    .select('*, blocks(name, order_index, estimated_sessions)')
    .eq('class_id', classId)
    .order('start_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch class blocks: ${error.message}`);
  }

  const rows: ClassBlockQueryRow[] = (data ?? []) as ClassBlockQueryRow[];

  return rows
    .map(({ blocks, ...rest }) => ({
      ...rest,
      block_name: blocks?.name ?? undefined,
      block_order_index: blocks?.order_index ?? null,
      block_estimated_sessions: blocks?.estimated_sessions ?? null,
    }))
    .sort((a, b) => (a.block_order_index ?? 0) - (b.block_order_index ?? 0));
}

export async function getClassBlockById(id: string): Promise<ClassBlockRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('class_blocks').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch class block: ${error.message}`);
  }

  return data;
}

export async function createClassBlock(input: CreateClassBlockInput): Promise<ClassBlockRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesInsert<'class_blocks'> = {
    class_id: input.classId,
    block_id: input.blockId,
    start_date: input.startDate,
    end_date: input.endDate,
    pitching_day_date: input.pitchingDayDate ?? null,
    status: input.status ?? 'UPCOMING',
  };

  const { data, error } = await supabase
    .from('class_blocks')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create class block: ${error.message}`);
  }

  return data;
}

export async function deleteClassBlock(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('class_blocks').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete class block: ${error.message}`);
  }
}

export async function deleteClass(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('classes').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete class: ${error.message}`);
  }
}

export async function updateClassBlock(
  id: string,
  updates: Partial<{
    status: ClassBlockRecord['status'];
    startDate: string;
    endDate: string;
    pitchingDayDate: string | null;
  }>,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const payload: TablesUpdate<'class_blocks'> = {};
  if (updates.status !== undefined) {
    payload.status = updates.status;
  }
  if (updates.startDate !== undefined) {
    payload.start_date = updates.startDate;
  }
  if (updates.endDate !== undefined) {
    payload.end_date = updates.endDate;
  }
  if (updates.pitchingDayDate !== undefined) {
    payload.pitching_day_date = updates.pitchingDayDate;
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  const { error } = await supabase.from('class_blocks').update(payload).eq('id', id);
  if (error) {
    throw new Error(`Failed to update class block: ${error.message}`);
  }
}

export type EnrollCoderInput = {
  classId: string;
  coderId: string;
};

export async function enrollCoder(input: EnrollCoderInput): Promise<EnrollmentRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesInsert<'enrollments'> = {
    class_id: input.classId,
    coder_id: input.coderId,
  };

  const { data, error } = await supabase
    .from('enrollments')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to enroll coder: ${error.message}`);
  }

  return data;
}

type ListEnrollmentOptions = {
  includeInactive?: boolean;
};

export async function listEnrollmentsByClass(classId: string, options: ListEnrollmentOptions = {}): Promise<EnrollmentRecord[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('enrollments')
    .select('*')
    .eq('class_id', classId)
    .order('enrolled_at', { ascending: true });

  if (!options.includeInactive) {
    query = query.eq('status', 'ACTIVE');
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list enrollments: ${error.message}`);
  }

  return data ?? [];
}

export async function updateEnrollmentStatus(classId: string, coderId: string, status: EnrollmentRecord['status']): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('enrollments')
    .update({ status })
    .eq('class_id', classId)
    .eq('coder_id', coderId);

  if (error) {
    throw new Error(`Failed to update enrollment status: ${error.message}`);
  }
}

export async function deleteEnrollment(classId: string, coderId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('enrollments')
    .delete()
    .eq('class_id', classId)
    .eq('coder_id', coderId);

  if (error) {
    throw new Error(`Failed to remove enrollment: ${error.message}`);
  }
}

export async function listClassesForCoach(coachId: string): Promise<ClassRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('coach_id', coachId)
    .order('start_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to list coach classes: ${error.message}`);
  }

  return data ?? [];
}

export async function listClassesForCoder(coderId: string): Promise<ClassRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('enrollments')
    .select('classes(*)')
    .eq('coder_id', coderId)
    .order('enrolled_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to list classes for coder: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ classes: ClassRecord | null }>;
  return rows.map((row) => row.classes).filter((klass): klass is ClassRecord => Boolean(klass));
}

export async function isCoderEnrolled(classId: string, coderId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('enrollments')
    .select('id')
    .eq('class_id', classId)
    .eq('coder_id', coderId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check enrollment: ${error.message}`);
  }

  return !!data;
}
