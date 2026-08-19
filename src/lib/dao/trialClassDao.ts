import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { Database } from '@/types/supabase';

export type TrialClassSubmission = Database['public']['Tables']['trial_class_submissions']['Row'];
export type TrialClassStatus = TrialClassSubmission['status'];
export type TrialClassSubmissionWithCoach = TrialClassSubmission & {
  coach: { id: string; full_name: string; username: string } | null;
};
export type TrialClassAdminSubmission = TrialClassSubmissionWithCoach & {
  trial_assessments?: {
    status: string;
    invoice?: { status: string } | null;
  } | Array<{
    status: string;
    invoice?: { status: string } | null;
  }> | null;
};

export type CreateTrialClassSubmissionInput = Pick<
  TrialClassSubmission,
  'student_name' | 'student_grade' | 'school_name' | 'parent_name' | 'phone' | 'email' | 'trial_mode' | 'notes'
>;

export async function createTrialClassSubmission(input: CreateTrialClassSubmissionInput) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('trial_class_submissions').insert(input).select('*').single();

  if (error) {
    throw new Error(`Failed to save trial class submission: ${error.message}`);
  }

  return data;
}

export async function listTrialClassSubmissions(limit = 500): Promise<TrialClassAdminSubmission[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('trial_class_submissions')
    .select('*, coach:users!trial_class_submissions_coach_id_fkey(id, full_name, username), trial_assessments(status, invoice:invoices!trial_assessments_invoice_id_fkey(status))')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load trial class submissions: ${error.message}`);
  }

  return (data ?? []) as unknown as TrialClassAdminSubmission[];
}

export function isUpcomingTrial(scheduledAt: string | null, now: Date): boolean {
  if (!scheduledAt) return false;
  const scheduledTime = new Date(scheduledAt).getTime();
  return Number.isFinite(scheduledTime) && scheduledTime >= now.getTime();
}

type TrialClassRowWithAssessment = TrialClassSubmission & {
  trial_assessments?: { status: string } | Array<{ status: string }> | null;
};

export function filterActionableTrialClassRows(
  rows: TrialClassRowWithAssessment[],
  _now = new Date(),
): TrialClassSubmission[] {
  return rows.flatMap((trial) => {
    // Keep an unfinished scheduled trial visible after its start time so the
    // assigned Coach can still submit the assessment. Completed assessments
    // are filtered below; terminal trial statuses remain excluded.
    if (trial.status !== 'SCHEDULED' || !trial.scheduled_at || !Number.isFinite(new Date(trial.scheduled_at).getTime())) {
      return [];
    }

    const assessment = trial.trial_assessments;
    const assessmentStatus = Array.isArray(assessment)
      ? assessment[0]?.status
      : assessment?.status;

    if (assessmentStatus && assessmentStatus !== 'DRAFT') {
      return [];
    }

    const { trial_assessments: _assessment, ...submission } = trial;
    return [submission as TrialClassSubmission];
  });
}

export async function listActionableTrialClassesForCoach(
  coachId: string,
  now = new Date(),
): Promise<TrialClassSubmission[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('trial_class_submissions')
    .select('*, trial_assessments(status)')
    .eq('coach_id', coachId)
    .eq('status', 'SCHEDULED')
    .not('scheduled_at', 'is', null)
    .order('scheduled_at', { ascending: true })
    .limit(100);

  if (error) {
    throw new Error(`Failed to load coach trial classes: ${error.message}`);
  }

  return filterActionableTrialClassRows(
    (data ?? []) as unknown as TrialClassRowWithAssessment[],
    now,
  );
}

export async function getTrialClassSubmission(id: string): Promise<TrialClassSubmissionWithCoach | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('trial_class_submissions')
    .select('*, coach:users!trial_class_submissions_coach_id_fkey(id, full_name, username)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load trial class submission: ${error.message}`);
  }

  return data as unknown as TrialClassSubmissionWithCoach | null;
}

type AssignTrialClassInput = {
  coachId: string;
  scheduledAt: string;
  durationMinutes: number;
  assignedBy: string;
  googleCalendarEventId: string | null;
  googleMeetUrl: string | null;
};

export async function assignTrialClass(id: string, input: AssignTrialClassInput): Promise<TrialClassSubmission> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('trial_class_submissions')
    .update({
      status: 'SCHEDULED',
      coach_id: input.coachId,
      scheduled_at: input.scheduledAt,
      duration_minutes: input.durationMinutes,
      status_reason: null,
      assigned_at: new Date().toISOString(),
      assigned_by: input.assignedBy,
      google_calendar_event_id: input.googleCalendarEventId,
      google_meet_url: input.googleMeetUrl,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to assign trial class: ${error.message}`);
  }

  return data;
}

export async function setTrialClassTerminalStatus(
  id: string,
  status: Extract<TrialClassStatus, 'CANCELLED' | 'FAILED'>,
  reason: string,
): Promise<TrialClassSubmission> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('trial_class_submissions')
    .update({
      status,
      status_reason: reason,
      google_calendar_event_id: null,
      google_meet_url: null,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update trial class status: ${error.message}`);
  }

  return data;
}

export async function deleteTrialClassSubmission(id: string): Promise<TrialClassSubmission> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('trial_class_submissions')
    .delete()
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to delete trial class submission: ${error.message}`);
  }

  return data;
}
