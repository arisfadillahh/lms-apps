"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { TablesInsert, TablesRow } from '@/types/supabase';

type MaterialRecord = TablesRow<'materials'>;

type MaterialWithSession = MaterialRecord & {
  session?: { date_time: string } | null;
};

export type CreateMaterialInput = {
  classId: string;
  sessionId?: string | null;
  blockId?: string | null;
  title: string;
  description?: string | null;
  fileUrl?: string | null;
  coachNote?: string | null;
  visibleFromSessionId?: string | null;
  uploadedByUserId: string;
  uploadedByRole: MaterialRecord['uploaded_by_role'];
};

export async function createMaterial(input: CreateMaterialInput): Promise<MaterialRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesInsert<'materials'> = {
    class_id: input.classId,
    session_id: input.sessionId ?? null,
    block_id: input.blockId ?? null,
    title: input.title,
    description: input.description ?? null,
    file_url: input.fileUrl ?? null,
    coach_note: input.coachNote ?? null,
    visible_from_session_id: input.visibleFromSessionId ?? null,
    uploaded_by_user_id: input.uploadedByUserId,
    uploaded_by_role: input.uploadedByRole,
  };

  const { data, error } = await supabase.from('materials').insert(payload).select('*').single();

  if (error) {
    throw new Error(`Failed to create material: ${error.message}`);
  }

  return data;
}

export async function listMaterialsByClass(classId: string): Promise<MaterialRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list materials: ${error.message}`);
  }

  return data ?? [];
}

export type VisibleMaterialsParams = {
  classId: string;
  nowIso: string;
  lastAccessibleSessionIds: Set<string>;
};

export async function listVisibleMaterialsForCoder({
  classId,
  nowIso,
  lastAccessibleSessionIds,
}: VisibleMaterialsParams): Promise<MaterialRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('materials')
    .select('*, session:session_id(date_time)')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load materials: ${error.message}`);
  }

  const now = new Date(nowIso);
  const rows = (data ?? []) as MaterialWithSession[];
  return rows
    .filter((material) => {
      const sessionDate = material.session?.date_time ? new Date(material.session.date_time) : null;
      const visibleFromSessionId = material.visible_from_session_id ?? null;

      const releasedByDate = sessionDate ? now.getTime() >= sessionDate.getTime() : true;
      const releasedByProgress = visibleFromSessionId
        ? lastAccessibleSessionIds.has(visibleFromSessionId)
        : true;

      return releasedByDate || releasedByProgress;
    })
    .map((material) => ({
      id: material.id,
      class_id: material.class_id,
      session_id: material.session_id,
      block_id: material.block_id,
      title: material.title,
      description: material.description,
      file_url: material.file_url,
      coach_note: material.coach_note,
      visible_from_session_id: material.visible_from_session_id,
      uploaded_by_user_id: material.uploaded_by_user_id,
      uploaded_by_role: material.uploaded_by_role,
      created_at: material.created_at,
    } as MaterialRecord));
}
