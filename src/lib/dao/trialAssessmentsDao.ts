import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { Invoice } from '@/lib/types/invoice';
import type { TablesInsert, TablesRow, TablesUpdate } from '@/types/supabase';

export type TrialAssessmentRecord = TablesRow<'trial_assessments'>;
export type TrialAssessmentStatus = TrialAssessmentRecord['status'];

export type TrialAssessmentWithRelations = TrialAssessmentRecord & {
  trial: (TablesRow<'trial_class_submissions'> & {
    coach?: Pick<TablesRow<'users'>, 'id' | 'full_name' | 'username'> | null;
  }) | null;
  coach?: Pick<TablesRow<'users'>, 'id' | 'full_name' | 'username' | 'parent_contact_phone'> | null;
  recommended_level?: Pick<TablesRow<'levels'>, 'id' | 'name'> | null;
  recommended_class?: Pick<TablesRow<'classes'>, 'id' | 'name' | 'type' | 'level_id' | 'schedule_day' | 'schedule_time'> | null;
  invoice?: Pick<Invoice, 'id' | 'invoice_number' | 'status' | 'total_amount' | 'paid_at' | 'parent_phone'> | null;
};

const ASSESSMENT_SELECT = `
  *,
  trial:trial_class_submissions(*, coach:users!trial_class_submissions_coach_id_fkey(id, full_name, username)),
  coach:users!trial_assessments_coach_id_fkey(id, full_name, username, parent_contact_phone),
  recommended_level:levels!trial_assessments_recommended_level_id_fkey(id, name),
  recommended_class:classes!trial_assessments_recommended_class_id_fkey(id, name, type, level_id, schedule_day, schedule_time),
  invoice:invoices!trial_assessments_invoice_id_fkey(id, invoice_number, status, total_amount, paid_at, parent_phone)
`;

export async function getAssessmentByTrialId(trialId: string): Promise<TrialAssessmentRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('trial_assessments')
    .select('*')
    .eq('trial_id', trialId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch trial assessment: ${error.message}`);
  }

  return data;
}

export async function getAssessmentWithRelations(id: string): Promise<TrialAssessmentWithRelations | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('trial_assessments')
    .select(ASSESSMENT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch trial assessment detail: ${error.message}`);
  }

  return data as unknown as TrialAssessmentWithRelations | null;
}

export async function getAssessmentByPublicToken(token: string): Promise<TrialAssessmentWithRelations | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('trial_assessments')
    .select(ASSESSMENT_SELECT)
    .eq('public_token', token)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch public trial report: ${error.message}`);
  }

  return data as unknown as TrialAssessmentWithRelations | null;
}

export async function getOrCreateDraftAssessment(input: {
  trialId: string;
  coachId: string;
}): Promise<TrialAssessmentRecord> {
  const existing = await getAssessmentByTrialId(input.trialId);
  if (existing) return existing;

  const supabase = getSupabaseAdmin();
  const payload: TablesInsert<'trial_assessments'> = {
    trial_id: input.trialId,
    coach_id: input.coachId,
    status: 'DRAFT',
  };
  const { data, error } = await supabase
    .from('trial_assessments')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      const raced = await getAssessmentByTrialId(input.trialId);
      if (raced) return raced;
    }
    throw new Error(`Failed to create draft trial assessment: ${error.message}`);
  }

  return data;
}

export async function updateAssessment(
  id: string,
  updates: TablesUpdate<'trial_assessments'>,
): Promise<TrialAssessmentRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('trial_assessments')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update trial assessment: ${error.message}`);
  }

  return data;
}

export async function listTrialAssessmentsForAdmin(limit = 300): Promise<TrialAssessmentWithRelations[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('trial_assessments')
    .select(ASSESSMENT_SELECT)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list trial assessments: ${error.message}`);
  }

  return (data ?? []) as unknown as TrialAssessmentWithRelations[];
}

export async function listTrialAssessmentsForCoach(coachId: string, limit = 100): Promise<TrialAssessmentWithRelations[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('trial_assessments')
    .select(ASSESSMENT_SELECT)
    .eq('coach_id', coachId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list coach trial assessments: ${error.message}`);
  }

  return (data ?? []) as unknown as TrialAssessmentWithRelations[];
}

export async function findAssessmentByInvoiceId(invoiceId: string): Promise<TrialAssessmentRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('trial_assessments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find trial assessment by invoice: ${error.message}`);
  }

  return data;
}
