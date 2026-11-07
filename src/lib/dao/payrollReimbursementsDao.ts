import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { PayrollError } from '@/lib/payroll/model';
import { REIMBURSEMENT_BUCKET, type ReimbursementRequest } from '@/lib/payroll/reimbursementTypes';

const db = () => getSupabaseAdmin() as SupabaseClient;
function fail(error: { message: string; code?: string; status?: number } | null) {
  if (!error) return;
  if (error.code === 'PT409' || error.code === '40001' || error.code === '23505' || error.status === 409 || error.message.includes('PAYROLL_CONFLICT')) throw new PayrollError('Pengajuan sudah berubah atau terkirim. Muat ulang sebelum mencoba lagi.', 409);
  if (error.message.includes('REIMBURSEMENT_CLOSED')) throw new PayrollError('Pengajuan ditutup tanggal 25 pukul 17.00 WIB atau periode sudah final.', 410);
  if (error.message.includes('REIMBURSEMENT_REOPEN')) throw new PayrollError('Buka revisi periode final sebelum mengubah persetujuan. Tunggu jika pengiriman sedang berlangsung.', 409);
  if (error.message.includes('REIMBURSEMENT_LIMIT')) throw new PayrollError('Batas 30 pengajuan per periode tercapai. Hubungi admin.', 429);
  if (error.message.includes('REIMBURSEMENT_NOT_FOUND')) throw new PayrollError('Pengajuan tidak ditemukan.', 404);
  if (error.message.includes('REIMBURSEMENT_INACTIVE')) throw new PayrollError('Penerima sudah tidak aktif. Periksa profil sebelum menyetujui.', 409);
  throw new PayrollError('Gagal menyimpan reimbursement. Periksa migrasi atau coba lagi.', 500);
}

export async function reimbursementProfile(id: string) {
  const { data, error } = await db().from('payroll_profiles').select('id,name,active,kind').eq('id', id).maybeSingle();
  fail(error); return data as { id: string; name: string; active: boolean; kind: 'COACH' | 'STAFF' } | null;
}
export async function reimbursementRequest(id: string): Promise<ReimbursementRequest | null> {
  const { data, error } = await db().from('payroll_reimbursements').select('*').eq('id', id).maybeSingle();
  fail(error); return data;
}
export async function reimbursementRequestCount(periodId: string, profileId: string): Promise<number> {
  const { count, error } = await db().from('payroll_reimbursements').select('id', { count: 'exact', head: true }).eq('period_id', periodId).eq('profile_id', profileId);
  fail(error); return count ?? 0;
}
export async function listReimbursementRequests(periodId: string, profileId?: string): Promise<(ReimbursementRequest & { recipient_name: string })[]> {
  const all: (ReimbursementRequest & { recipient_name: string })[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = db().from('payroll_reimbursements').select('*,profile:payroll_profiles(name)').eq('period_id', periodId).order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
    if (profileId) query = query.eq('profile_id', profileId);
    const { data, error } = await query; fail(error);
    const rows = (data ?? []) as unknown as (ReimbursementRequest & { profile: { name: string } | null })[];
    all.push(...rows.map(({ profile, ...row }) => ({ ...row, recipient_name: profile?.name ?? 'Penerima' })));
    if (rows.length < 500) return all;
  }
}
export async function insertReimbursementRequest(input: Pick<ReimbursementRequest, 'id' | 'profile_id' | 'period_id' | 'title' | 'amount' | 'evidence_path' | 'evidence_bytes' | 'content_hash'>): Promise<ReimbursementRequest> {
  const { data, error } = await db().rpc('payroll_submit_reimbursement', { p_id: input.id, p_profile_id: input.profile_id, p_period_id: input.period_id, p_title: input.title, p_amount: input.amount, p_evidence_path: input.evidence_path, p_evidence_bytes: input.evidence_bytes, p_content_hash: input.content_hash });
  fail(error); return data as ReimbursementRequest;
}
export async function reviewReimbursementRequest(input: { id: string; revision: number; status: 'APPROVED' | 'REJECTED'; reason: string }, actor: string): Promise<ReimbursementRequest> {
  const { data, error } = await db().rpc('payroll_review_reimbursement', { p_id: input.id, p_expected_revision: input.revision, p_status: input.status, p_reason: input.reason, p_actor_id: actor });
  fail(error); return data as ReimbursementRequest;
}
async function privateBucket() {
  const client = db();
  const { data, error } = await client.storage.getBucket(REIMBURSEMENT_BUCKET);
  if (error || !data || data.public) throw new PayrollError('Penyimpanan bukti reimbursement belum tersedia sebagai bucket privat.', 500);
  return client.storage.from(REIMBURSEMENT_BUCKET);
}
export async function uploadReimbursementEvidence(path: string, buffer: Buffer) {
  const bucket = await privateBucket();
  const { error } = await bucket.upload(path, buffer, { contentType: 'image/webp', upsert: false, cacheControl: '0' });
  if (error) throw new PayrollError('Foto bukti gagal disimpan. Coba lagi.', 500);
}
export async function deleteReimbursementEvidence(path: string) {
  const bucket = await privateBucket();
  const { error } = await bucket.remove([path]);
  if (error) throw new PayrollError('Pembersihan foto duplikat gagal.', 500);
}
export async function downloadReimbursementEvidence(path: string): Promise<ArrayBuffer> {
  const bucket = await privateBucket();
  const { data, error } = await bucket.download(path);
  if (error || !data) throw new PayrollError('Foto bukti tidak ditemukan.', 404);
  return data.arrayBuffer();
}
