import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { Database } from '@/types/supabase';

export type TrialClassSubmission = Database['public']['Tables']['trial_class_submissions']['Row'];
export type TrialClassStatus = TrialClassSubmission['status'];
export type TrialClassSubmissionWithCoach = TrialClassSubmission & {
  coach: { id: string; full_name: string; username: string } | null;
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

export async function listTrialClassSubmissions(limit = 500) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('trial_class_submissions')
    .select('*, coach:users!trial_class_submissions_coach_id_fkey(id, full_name, username)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load trial class submissions: ${error.message}`);
  }

  return (data ?? []) as unknown as TrialClassSubmissionWithCoach[];
}

export async function listUpcomingTrialClassesForCoach(
  coachId: string,
  now = new Date(),
): Promise<TrialClassSubmission[]> {
  const supabase = getSupabaseAdmin();
  const earliestRelevantStart = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from('trial_class_submissions')
    .select('*')
    .eq('coach_id', coachId)
    .eq('status', 'SCHEDULED')
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', earliestRelevantStart.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(20);

  if (error) {
    throw new Error(`Failed to load coach trial classes: ${error.message}`);
  }

  return (data ?? []).filter((trial) => {
    if (!trial.scheduled_at) return false;

    const endTime = new Date(trial.scheduled_at).getTime() + trial.duration_minutes * 60 * 1000;
    return endTime >= now.getTime();
  });
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
