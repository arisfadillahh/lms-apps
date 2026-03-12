"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type {
  Json,
  TablesInsert,
  TablesRow,
  TablesUpdate,
} from '@/types/supabase';

export type PitchingDayReportRecord = TablesRow<'pitching_day_reports'>;
export type WhatsappLogRecord = TablesRow<'whatsapp_message_logs'>;

export type CreatePitchingDayReportInput = {
  rubricSubmissionId: string;
  pdfUrl: string;
  storagePath: string;
};

export async function createPitchingDayReport(input: CreatePitchingDayReportInput): Promise<PitchingDayReportRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesInsert<'pitching_day_reports'> = {
    rubric_submission_id: input.rubricSubmissionId,
    pdf_url: input.pdfUrl,
    storage_path: input.storagePath,
    sent_via_whatsapp: false,
  };

  const { data, error } = await supabase
    .from('pitching_day_reports')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create pitching day report: ${error.message}`);
  }

  return data;
}

export async function upsertPitchingDayReport(input: CreatePitchingDayReportInput): Promise<PitchingDayReportRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesInsert<'pitching_day_reports'> = {
    rubric_submission_id: input.rubricSubmissionId,
    pdf_url: input.pdfUrl,
    storage_path: input.storagePath,
    sent_via_whatsapp: false,
    sent_to_parent_at: null,
  };

  const { data, error } = await supabase
    .from('pitching_day_reports')
    .upsert(payload, { onConflict: 'rubric_submission_id' })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to upsert pitching day report: ${error.message}`);
  }

  return data;
}

export async function getReportBySubmissionId(submissionId: string): Promise<PitchingDayReportRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('pitching_day_reports')
    .select('*')
    .eq('rubric_submission_id', submissionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch pitching day report: ${error.message}`);
  }

  return data;
}

export async function getReportById(id: string): Promise<PitchingDayReportRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('pitching_day_reports').select('*').eq('id', id).maybeSingle();
  if (error) {
    throw new Error(`Failed to fetch pitching day report: ${error.message}`);
  }
  return data;
}

export async function markReportSent(reportId: string, sentAtIso: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const payload: TablesUpdate<'pitching_day_reports'> = {
    sent_via_whatsapp: true,
    sent_to_parent_at: sentAtIso,
  };

  const { error } = await supabase.from('pitching_day_reports').update(payload).eq('id', reportId);

  if (error) {
    throw new Error(`Failed to update report sent status: ${error.message}`);
  }
}

export type WhatsappLogInput = {
  category: WhatsappLogRecord['category'];
  payload: Json;
  status?: WhatsappLogRecord['status'];
  response?: Json | null;
};

export async function logWhatsappEvent(input: WhatsappLogInput): Promise<WhatsappLogRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesInsert<'whatsapp_message_logs'> = {
    category: input.category,
    payload: input.payload,
    status: input.status ?? 'QUEUED',
    response: input.response ?? null,
  };

  const { data, error } = await supabase
    .from('whatsapp_message_logs')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to log WhatsApp event: ${error.message}`);
  }

  return data;
}

export async function updateWhatsappLogStatus(
  id: string,
  status: WhatsappLogRecord['status'],
  response?: Json | null,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const payload: TablesUpdate<'whatsapp_message_logs'> = {
    status,
    response: response ?? null,
  };

  const { error } = await supabase.from('whatsapp_message_logs').update(payload).eq('id', id);

  if (error) {
    throw new Error(`Failed to update WhatsApp log status: ${error.message}`);
  }
}

export async function listWhatsappLogs(limit = 50): Promise<WhatsappLogRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('whatsapp_message_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch WhatsApp logs: ${error.message}`);
  }

  return data ?? [];
}

export async function listReportsByCoder(coderId: string): Promise<PitchingDayReportRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data: submissions, error: submissionsError } = await supabase
    .from('rubric_submissions')
    .select('id')
    .eq('coder_id', coderId);

  if (submissionsError) {
    throw new Error(`Failed to fetch rubric submissions: ${submissionsError.message}`);
  }

  const submissionIds = (submissions ?? []).map((row) => row.id);
  if (submissionIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('pitching_day_reports')
    .select('*')
    .in('rubric_submission_id', submissionIds)
    .order('generated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list reports: ${error.message}`);
  }

  return data ?? [];
}

export type ReportSummary = {
  report: PitchingDayReportRecord;
  submission: Pick<
    TablesRow<'rubric_submissions'>,
    'id' | 'coder_id' | 'class_id' | 'block_id' | 'semester_tag' | 'submitted_at'
  >;
  className: string;
  classType: TablesRow<'classes'>['type'];
  coderName: string;
  blockName?: string | null;
};

export async function listReportSummaries(): Promise<ReportSummary[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('pitching_day_reports')
    .select(
      `
      *,
      rubric_submissions (
        id,
        coder_id,
        class_id,
        block_id,
        semester_tag,
        submitted_at,
        classes:classes (
          id,
          name,
          type
        ),
        blocks:blocks (
          id,
          name
        ),
        coder:users!rubric_submissions_coder_id_fkey (
          id,
          full_name
        )
      )
    `,
    )
    .order('generated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list report summaries: ${error.message}`);
  }

  return (data ?? []).map((row: any) => {
    const submission = row.rubric_submissions ?? {};
    return {
      report: {
        id: row.id,
        rubric_submission_id: row.rubric_submission_id,
        pdf_url: row.pdf_url,
        storage_path: row.storage_path,
        generated_at: row.generated_at,
        sent_via_whatsapp: row.sent_via_whatsapp,
        sent_to_parent_at: row.sent_to_parent_at,
      } as PitchingDayReportRecord,
      submission: {
        id: submission.id ?? '',
        coder_id: submission.coder_id ?? '',
        class_id: submission.class_id ?? '',
        block_id: submission.block_id ?? null,
        semester_tag: submission.semester_tag ?? null,
        submitted_at: submission.submitted_at ?? null,
      } as ReportSummary['submission'],
      className: submission.classes?.name ?? 'Class',
      classType: submission.classes?.type ?? 'WEEKLY',
      coderName: submission.coder?.full_name ?? 'Coder',
      blockName: submission.blocks?.name ?? null,
    };
  });
}

export async function listPendingReports(): Promise<ReportSummary[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('pitching_day_reports')
    .select(
      `*, rubric_submissions(id, coder_id, class_id, block_id, semester_tag, submitted_at, classes:classes(id, name), coder:users!rubric_submissions_coder_id_fkey(id, full_name, parent_contact_phone))`,
    )
    .eq('sent_via_whatsapp', false);

  if (error) {
    throw new Error(`Failed to fetch pending reports: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    report: {
      id: row.id,
      rubric_submission_id: row.rubric_submission_id,
      pdf_url: row.pdf_url,
      storage_path: row.storage_path,
      generated_at: row.generated_at,
      sent_via_whatsapp: row.sent_via_whatsapp,
      sent_to_parent_at: row.sent_to_parent_at,
    } as PitchingDayReportRecord,
    submission: {
      id: row.rubric_submissions?.id ?? '',
      coder_id: row.rubric_submissions?.coder_id ?? '',
      class_id: row.rubric_submissions?.class_id ?? '',
      block_id: row.rubric_submissions?.block_id ?? null,
      semester_tag: row.rubric_submissions?.semester_tag ?? null,
      submitted_at: row.rubric_submissions?.submitted_at ?? null,
    },
    className: row.rubric_submissions?.classes?.name ?? 'Class',
    classType: row.rubric_submissions?.classes?.type ?? 'WEEKLY',
    coderName: row.rubric_submissions?.coder?.full_name ?? 'Coder',
    blockName: row.rubric_submissions?.blocks?.name ?? null,
  }));
}

export async function listUnsentReports(): Promise<PitchingDayReportRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('pitching_day_reports')
    .select('*')
    .eq('sent_via_whatsapp', false);

  if (error) {
    throw new Error(`Failed to fetch pending reports: ${error.message}`);
  }

  return data ?? [];
}

// --- NEW REWORKED CODER REPORTS SYSTEM ---

export type EvaluationCriteriaRecord = TablesRow<'evaluation_criteria'>;
export type LessonEvaluationRecord = TablesRow<'lesson_evaluations'>;
export type BlockReportRecord = TablesRow<'block_reports'>;
export type BlockReportDescriptionRecord = TablesRow<'block_report_descriptions'>;

// 1. Evaluation Criteria
export async function getEvaluationCriteria(): Promise<EvaluationCriteriaRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('evaluation_criteria')
    .select('*')
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch evaluation criteria: ${error.message}`);
  }

  return data ?? [];
}

// 2. Lesson Evaluations
export type UpsertLessonEvaluationInput = {
  sessionId: string;
  coderId: string;
  criteriaId: string;
  score: number;
};

export async function upsertLessonEvaluations(evaluations: UpsertLessonEvaluationInput[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const payload: TablesInsert<'lesson_evaluations'>[] = evaluations.map(e => ({
    session_id: e.sessionId,
    coder_id: e.coderId,
    criteria_id: e.criteriaId,
    score: e.score,
  }));

  const { error } = await supabase
    .from('lesson_evaluations')
    .upsert(payload, { onConflict: 'session_id,coder_id,criteria_id' });

  if (error) {
    throw new Error(`Failed to upsert lesson evaluations: ${error.message}`);
  }
}

export async function getLessonEvaluationsBySession(sessionId: string): Promise<LessonEvaluationRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('lesson_evaluations')
    .select('*')
    .eq('session_id', sessionId);
    
  if (error) {
    throw new Error(`Failed to fetch lesson evaluations: ${error.message}`);
  }
  
  return data ?? [];
}

// 3. Block Reports
export type UpsertBlockReportInput = {
  classId: string;
  blockId: string;
  coderId: string;
  status?: 'DRAFT' | 'SUBMITTED' | 'PUBLISHED' | 'SENT';
  averageScore?: number | null;
  grade?: string | null;
  isAiGenerated?: boolean;
};

export async function upsertBlockReport(input: UpsertBlockReportInput): Promise<BlockReportRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesInsert<'block_reports'> = {
    class_id: input.classId,
    block_id: input.blockId,
    coder_id: input.coderId,
    status: input.status,
    average_score: input.averageScore,
    grade: input.grade,
    is_ai_generated: input.isAiGenerated ?? false,
  };

  const { data, error } = await supabase
    .from('block_reports')
    .upsert(payload, { onConflict: 'class_id,block_id,coder_id' })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to upsert block report: ${error.message}`);
  }

  return data;
}

export async function getBlockReport(classId: string, blockId: string, coderId: string): Promise<BlockReportRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('block_reports')
    .select('*')
    .eq('class_id', classId)
    .eq('block_id', blockId)
    .eq('coder_id', coderId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch block report: ${error.message}`);
  }

  return data;
}

export async function getBlockReportById(id: string): Promise<BlockReportRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('block_reports')
    .select('*')
    .eq('id', id)
    .maybeSingle();
    
  if (error) {
    throw new Error(`Failed to fetch block report by id: ${error.message}`);
  }
  return data;
}

export async function getBlockReportDescriptions(reportId: string): Promise<BlockReportDescriptionRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('block_report_descriptions')
    .select('*')
    .eq('report_id', reportId);
    
  if (error) {
    throw new Error(`Failed to fetch block report descriptions: ${error.message}`);
  }
  return data ?? [];
}

export type UpsertBlockReportDescriptionInput = {
  reportId: string;
  criteriaId: string;
  score: number;
  description: string;
};

export async function upsertBlockReportDescriptions(descriptions: UpsertBlockReportDescriptionInput[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (descriptions.length === 0) return;
  
  const payload: TablesInsert<'block_report_descriptions'>[] = descriptions.map(d => ({
    report_id: d.reportId,
    criteria_id: d.criteriaId,
    score: d.score,
    description: d.description
  }));

  const { error } = await supabase
    .from('block_report_descriptions')
    .upsert(payload, { onConflict: 'report_id,criteria_id' });

  if (error) {
    throw new Error(`Failed to upsert block report descriptions: ${error.message}`);
  }
}

export async function updateBlockReport(id: string, updates: Partial<TablesUpdate<'block_reports'>>): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('block_reports')
    .update(updates)
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update block report: ${error.message}`);
  }
}

export async function listBlockReportsByCoder(coderId: string): Promise<BlockReportRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('block_reports')
    .select('*')
    .eq('coder_id', coderId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list block reports by coder: ${error.message}`);
  }

  return data ?? [];
}

export async function listBlockReportsPendingSend(): Promise<BlockReportRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('block_reports')
    .select('*')
    .eq('status', 'SUBMITTED')
    .eq('sent_via_whatsapp', false)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list pending block reports: ${error.message}`);
  }

  return data ?? [];
}
