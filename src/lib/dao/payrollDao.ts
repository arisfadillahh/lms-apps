import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { createPeriod, PayrollError, type PayrollPerson, type PayrollTerm, type RateCard, type PayrollSettings, type PeriodRecord, type PeriodDocument } from '@/lib/payroll/model';

// Additive tables have local domain types until the next generated DB type refresh.
function db(): SupabaseClient { return getSupabaseAdmin() as SupabaseClient; }
function fail(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (error.code === '40001' || error.message.includes('PAYROLL_CONFLICT')) throw new PayrollError('Data sudah berubah. Muat ulang sebelum mengulang tindakan.', 409);
  if (error.code === '23505') throw new PayrollError('Data dengan identitas/tanggal berlaku tersebut sudah ada.', 409);
  throw new PayrollError(error.message, 500);
}
export async function getPayrollConfig() {
  const [profiles, terms, rates, settings] = await Promise.all([
    db().from('payroll_profiles').select('*').order('name'),
    db().from('payroll_terms').select('*').order('effective_from'),
    db().from('payroll_rate_cards').select('*').order('effective_from'),
    db().from('payroll_settings').select('*').eq('id', 1).single(),
  ]);
  for (const result of [profiles, terms, rates, settings]) fail(result.error);
  return { people: profiles.data as PayrollPerson[], terms: terms.data as PayrollTerm[], cards: rates.data as RateCard[], settings: settings.data as PayrollSettings };
}
export async function savePayrollProfile(person: Partial<PayrollPerson>, term: Omit<PayrollTerm, 'profile_id'>, actor: string): Promise<string> {
  const { data, error } = await db().rpc('payroll_save_profile', { p_profile: person, p_term: term, p_actor_id: actor });
  fail(error); return String(data);
}
export async function savePayrollRates(card: RateCard, actor: string) {
  const { error } = await db().from('payroll_rate_cards').upsert({ ...card, updated_by: actor }, { onConflict: 'effective_from' }); fail(error);
}
export async function savePayrollSettings(settings: PayrollSettings, actor: string) {
  const { error } = await db().from('payroll_settings').update({ ...settings, updated_by: actor }).eq('id', 1); fail(error);
}
export async function getPayrollPeriod(id: string): Promise<PeriodRecord | null> {
  const { data, error } = await db().from('payroll_periods').select('*').eq('id', id).maybeSingle(); fail(error); return data;
}
export async function ensurePayrollPeriod(year: number, month: number): Promise<PeriodRecord> {
  const document = createPeriod(year, month);
  const { error } = await db().from('payroll_periods').upsert({ id: document.id, document, revision: 0 }, { onConflict: 'id', ignoreDuplicates: true }); fail(error);
  const record = await getPayrollPeriod(document.id);
  if (!record) throw new PayrollError('Periode tidak ditemukan.', 404);
  return record;
}
export async function listPayrollPeriods(): Promise<PeriodRecord[]> {
  const { data, error } = await db().from('payroll_periods').select('*').order('id', { ascending: false }).limit(240); fail(error); return data ?? [];
}
export async function commitPayrollPeriod(record: PeriodRecord, document: PeriodDocument, actor: string | null, action: string, reason = ''): Promise<PeriodRecord> {
  const { data, error } = await db().rpc('payroll_commit_period', { p_id: record.id, p_expected_revision: record.revision, p_document: document, p_actor_id: actor, p_action: action, p_reason: reason });
  fail(error); return { id: record.id, revision: Number(data), document };
}
export async function getPayrollAudit(periodId: string) {
  const { data, error } = await db().from('payroll_audit').select('id,action,actor_id,reason,revision,created_at').eq('entity_key', `period:${periodId}`).order('created_at', { ascending: false }).limit(100); fail(error); return data ?? [];
}

// PostgREST defaults to 1000 rows. Explicit pagination prevents silently dropping
// older sessions, inactive enrollment history, or previously converted children.
export async function payrollRows(table: string, select: string, filters: { eq?: [string, string]; gte?: [string, string]; lt?: [string, string]; in?: [string, string[]] } = {}): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  if (filters.in && filters.in[1].length === 0) return all;
  const chunks = filters.in ? Array.from({ length: Math.ceil(filters.in[1].length / 100) }, (_, i) => filters.in![1].slice(i * 100, i * 100 + 100)) : [null];
  for (const chunk of chunks) for (let offset = 0; ; offset += 500) {
    let query = db().from(table).select(select).order('id').range(offset, offset + 499);
    if (filters.gte) query = query.gte(...filters.gte);
    if (filters.eq) query = query.eq(...filters.eq);
    if (filters.lt) query = query.lt(...filters.lt);
    if (filters.in && chunk) query = query.in(filters.in[0], chunk);
    const { data, error } = await query; fail(error);
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    all.push(...rows); if (rows.length < 500) break;
  }
  return all;
}
