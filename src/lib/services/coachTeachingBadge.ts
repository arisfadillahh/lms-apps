import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { effective, resolveTeachingMode, wibDate, currentPeriod, type PayrollTerm, type PeriodDocument } from '@/lib/payroll/model';

export async function coachTeachingBadge(coachId: string) {
  const db = getSupabaseAdmin();
  const { data: profile, error } = await db.from('payroll_profiles' as never).select('id').eq('user_id', coachId).maybeSingle();
  if (error) throw error;
  const profileId = (profile as { id: string } | null)?.id;
  const { data, error: termError } = profileId
    ? await db.from('payroll_terms' as never).select('*').eq('profile_id', profileId)
    : { data: [], error: null };
  if (termError) throw termError;
  const terms = (data ?? []) as PayrollTerm[];
  const periods = new Map<string, PeriodDocument | null>();
  return async (session: { id: string; date_time: string; payroll_mode?: string | null }, klass: { type: string; payroll_mode?: string | null }) => {
    const term = effective(terms, wibDate(session.date_time));
    if (term?.contract !== 'FULLTIME') return false;
    const periodId = currentPeriod(new Date(session.date_time)).id;
    if (!periods.has(periodId)) {
      const { data: period, error: periodError } = await db.from('payroll_periods' as never).select('document').eq('id', periodId).maybeSingle();
      if (periodError) throw periodError;
      periods.set(periodId, (period as { document: PeriodDocument } | null)?.document ?? null);
    }
    const mode = session.payroll_mode === 'MITRA' || session.payroll_mode === 'FULLTIME' ? session.payroll_mode : undefined;
    return resolveTeachingMode(term, {
      kind: klass.type, date: session.date_time, session_mode: mode,
      mode: klass.payroll_mode === 'MITRA' ? 'MITRA' : 'FULLTIME',
    }, periods.get(periodId)?.overrides[`session:${session.id}`]) === 'MITRA';
  };
}
