import { getSupabaseAdmin } from '@/lib/supabaseServer';

type GrantReason =
  | 'SESSION_COMPLETED'
  | 'MID_BLOCK_CATCH_UP'
  | 'TRANSFER_CATCH_UP'
  | 'MANUAL';

export type SessionAccessGrantInput = {
  coderId: string;
  classId: string;
  sessionId: string;
  grantedReason: GrantReason;
  sourceEnrollmentId?: string | null;
};

export type CoderSessionAccessRecord = {
  id: string;
  coder_id: string;
  class_id: string;
  session_id: string;
  granted_reason: GrantReason;
  granted_at: string;
  source_enrollment_id: string | null;
  created_at: string;
};

export async function grantSessionAccesses(inputs: SessionAccessGrantInput[]): Promise<void> {
  if (inputs.length === 0) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const deduped = Array.from(
    new Map(inputs.map((input) => [`${input.coderId}:${input.sessionId}`, input])).values(),
  );
  const payload = deduped.map((input) => ({
    coder_id: input.coderId,
    class_id: input.classId,
    session_id: input.sessionId,
    granted_reason: input.grantedReason,
    granted_at: new Date().toISOString(),
    source_enrollment_id: input.sourceEnrollmentId ?? null,
  }));

  const { error } = await (supabase.from('coder_session_access' as any) as any).upsert(payload, {
    onConflict: 'coder_id,session_id',
    ignoreDuplicates: true,
  });

  if (error) {
    throw new Error(`Failed to grant coder session access: ${error.message}`);
  }
}

export async function listSessionAccessByCoder(
  coderId: string,
): Promise<CoderSessionAccessRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase.from('coder_session_access' as any) as any)
    .select('*')
    .eq('coder_id', coderId)
    .order('granted_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list coder session access: ${error.message}`);
  }

  return (data ?? []) as CoderSessionAccessRecord[];
}

export async function listGrantedSessionIdsByCoder(coderId: string): Promise<Set<string>> {
  const rows = await listSessionAccessByCoder(coderId);
  return new Set(rows.map((row) => row.session_id));
}

export async function hasCoderSessionAccess(coderId: string, sessionId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase.from('coder_session_access' as any) as any)
    .select('id')
    .eq('coder_id', coderId)
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check coder session access: ${error.message}`);
  }

  return Boolean(data);
}

export async function grantSessionAccessForCompletedSession(sessionId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data: sessionRow, error: sessionError } = await supabase
    .from('sessions')
    .select('id, class_id, date_time')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError) {
    throw new Error(`Failed to load session for access grant: ${sessionError.message}`);
  }

  if (!sessionRow) {
    return 0;
  }

  const { data: enrollments, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('id, coder_id, enrolled_at, status')
    .eq('class_id', sessionRow.class_id)
    .eq('status', 'ACTIVE')
    .lte('enrolled_at', sessionRow.date_time);

  if (enrollmentError) {
    throw new Error(`Failed to load enrollments for access grant: ${enrollmentError.message}`);
  }

  const grants = (enrollments ?? []).map((enrollment: any) => ({
    coderId: enrollment.coder_id as string,
    classId: sessionRow.class_id,
    sessionId: sessionRow.id,
    grantedReason: 'SESSION_COMPLETED' as const,
    sourceEnrollmentId: enrollment.id as string,
  }));

  await grantSessionAccesses(grants);
  return grants.length;
}
