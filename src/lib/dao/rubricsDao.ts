"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type {
  Json,
  TablesInsert,
  TablesRow,
} from '@/types/supabase';

export type RubricTemplateRecord = TablesRow<'rubric_templates'>;
export type RubricSubmissionRecord = TablesRow<'rubric_submissions'>;

type ClassType = RubricTemplateRecord['class_type'];

export type CreateRubricTemplateInput = {
  classType: ClassType;
  levelId?: string | null;
  competencies: Json;
  positiveCharacters: string[];
  createdBy: string;
};

export async function createRubricTemplate(input: CreateRubricTemplateInput): Promise<RubricTemplateRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesInsert<'rubric_templates'> = {
    class_type: input.classType,
    level_id: input.levelId ?? null,
    competencies: input.competencies,
    positive_characters: input.positiveCharacters,
    created_by: input.createdBy,
  };

  const { data, error } = await supabase
    .from('rubric_templates')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create rubric template: ${error.message}`);
  }

  return data;
}

export async function listRubricTemplates(): Promise<RubricTemplateRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('rubric_templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list rubric templates: ${error.message}`);
  }

  return data ?? [];
}

export async function getRubricTemplateById(id: string): Promise<RubricTemplateRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('rubric_templates').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch rubric template: ${error.message}`);
  }

  return data;
}

export async function findRubricTemplate(classType: ClassType, levelId: string | null): Promise<RubricTemplateRecord | null> {
  const supabase = getSupabaseAdmin();
  const query = supabase
    .from('rubric_templates')
    .select('*')
    .eq('class_type', classType)
    .order('created_at', { ascending: false })
    .limit(1);

  if (levelId) {
    query.eq('level_id', levelId);
  } else {
    query.is('level_id', null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Failed to find rubric template: ${error.message}`);
  }

  return data;
}

export type SubmitRubricInput = {
  classId: string;
  coderId: string;
  blockId?: string | null;
  semesterTag?: string | null;
  rubricTemplateId: string;
  grades: Json;
  positiveCharacters: string[];
  narrative: string;
  submittedBy: string;
  status?: RubricSubmissionRecord['status'];
};

export async function submitRubric(input: SubmitRubricInput): Promise<RubricSubmissionRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesInsert<'rubric_submissions'> = {
    class_id: input.classId,
    coder_id: input.coderId,
    block_id: input.blockId ?? null,
    semester_tag: input.semesterTag ?? null,
    rubric_template_id: input.rubricTemplateId,
    grades: input.grades,
    positive_character_chosen: input.positiveCharacters,
    narrative: input.narrative,
    submitted_by: input.submittedBy,
    status: input.status ?? 'FINAL',
  };

  const { data, error } = await supabase
    .from('rubric_submissions')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to submit rubric: ${error.message}`);
  }

  return data;
}

export async function getRubricSubmissionById(id: string): Promise<RubricSubmissionRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('rubric_submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch rubric submission: ${error.message}`);
  }

  return data;
}

export async function listRubricSubmissionsByCoder(classId: string, coderId: string): Promise<RubricSubmissionRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('rubric_submissions')
    .select('*')
    .eq('class_id', classId)
    .eq('coder_id', coderId)
    .order('submitted_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list rubric submissions: ${error.message}`);
  }

  return data ?? [];
}

export type RubricSubmissionDetail = {
  submission: RubricSubmissionRecord;
  template: RubricTemplateRecord;
  class: TablesRow<'classes'>;
  blockName?: string | null;
  coder: Pick<TablesRow<'users'>, 'id' | 'full_name'>;
  coach: Pick<TablesRow<'users'>, 'id' | 'full_name'>;
};

export async function getRubricSubmissionDetail(submissionId: string): Promise<RubricSubmissionDetail | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('rubric_submissions')
    .select(
      `
      id,
      class_id,
      coder_id,
      block_id,
      semester_tag,
      rubric_template_id,
      grades,
      positive_character_chosen,
      narrative,
      submitted_by,
      submitted_at,
      updated_at,
      status,
      classes:classes (
        id,
        name,
        type,
        level_id,
        coach_id,
        schedule_day,
        schedule_time,
        zoom_link,
        start_date,
        end_date,
        created_at,
        updated_at
      ),
      blocks:blocks (
        id,
        name
      ),
      coder:users!rubric_submissions_coder_id_fkey (
        id,
        full_name
      ),
      template:rubric_templates (
        id,
        class_type,
        level_id,
        competencies,
        positive_characters,
        created_at,
        created_by
      )
    `,
    )
    .eq('id', submissionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load rubric submission detail: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const coachId = data.classes?.coach_id as string | undefined;
  let coach: Pick<TablesRow<'users'>, 'id' | 'full_name'> | null = null;

  if (coachId) {
    const { data: coachData, error: coachError } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('id', coachId)
      .maybeSingle();

    if (coachError) {
      throw new Error(`Failed to fetch coach info: ${coachError.message}`);
    }
    if (coachData) {
      coach = coachData as Pick<TablesRow<'users'>, 'id' | 'full_name'>;
    }
  }

  if (!coach) {
    coach = { id: coachId ?? '', full_name: 'Coach' };
  }

  const classRecord = data.classes as TablesRow<'classes'>;
  const template = data.template as RubricTemplateRecord;

  const submission = {
    id: data.id,
    class_id: data.class_id,
    coder_id: data.coder_id,
    block_id: data.block_id,
    semester_tag: data.semester_tag,
    rubric_template_id: data.rubric_template_id,
    grades: data.grades,
    positive_character_chosen: data.positive_character_chosen,
    narrative: data.narrative,
    submitted_by: data.submitted_by,
    submitted_at: data.submitted_at,
    updated_at: data.updated_at,
    status: data.status,
  } as RubricSubmissionRecord;

  const coder = data.coder as Pick<TablesRow<'users'>, 'id' | 'full_name'>;
  const blockName = (data.blocks as { name?: string } | null)?.name ?? null;

  return {
    submission,
    template,
    class: classRecord,
    blockName,
    coder,
    coach,
  };
}

export type SubmissionReportRow = {
  submission: RubricSubmissionRecord;
  class: Pick<TablesRow<'classes'>, 'id' | 'name' | 'type'>;
  coder: Pick<TablesRow<'users'>, 'id' | 'full_name'>;
  report: TablesRow<'pitching_day_reports'> | null;
  blockName?: string | null;
};

export async function listSubmissionsWithReports(limit = 50): Promise<SubmissionReportRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('rubric_submissions')
    .select(
      `
      id,
      class_id,
      coder_id,
      block_id,
      semester_tag,
      rubric_template_id,
      grades,
      positive_character_chosen,
      narrative,
      submitted_by,
      submitted_at,
      updated_at,
      status,
      classes:classes (
        id,
        name,
        type
      ),
      coder:users!rubric_submissions_coder_id_fkey (
        id,
        full_name
      ),
      blocks:blocks!left (
        id,
        name
      ),
      report:pitching_day_reports!left (
        id,
        rubric_submission_id,
        pdf_url,
        storage_path,
        generated_at,
        sent_via_whatsapp,
        sent_to_parent_at
      )
    `,
    )
    .order('submitted_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list rubric submissions with reports: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    submission: {
      id: row.id,
      class_id: row.class_id,
      coder_id: row.coder_id,
      block_id: row.block_id,
      semester_tag: row.semester_tag,
      rubric_template_id: row.rubric_template_id,
      grades: row.grades,
      positive_character_chosen: row.positive_character_chosen,
      narrative: row.narrative,
      submitted_by: row.submitted_by,
      submitted_at: row.submitted_at,
      updated_at: row.updated_at,
      status: row.status,
    } as RubricSubmissionRecord,
    class: {
      id: row.classes?.id ?? '',
      name: row.classes?.name ?? 'Class',
      type: row.classes?.type ?? 'WEEKLY',
    },
    coder: {
      id: row.coder?.id ?? '',
      full_name: row.coder?.full_name ?? 'Coder',
    },
    report: (Array.isArray(row.report) ? row.report[0] : row.report) ?? null,
    blockName: (Array.isArray(row.blocks) ? row.blocks[0]?.name : row.blocks?.name) ?? null,
  }));
}
