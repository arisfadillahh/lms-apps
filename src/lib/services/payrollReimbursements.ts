import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getPayrollPeriod } from '@/lib/dao/payrollDao';
import * as dao from '@/lib/dao/payrollReimbursementsDao';
import { PayrollError, type PeriodDocument } from '@/lib/payroll/model';
import { issueReimbursementToken, verifyReimbursementToken, ReimbursementTokenError, REIMBURSEMENT_LINK_MAX_AGE_SECONDS } from '@/lib/payroll/reimbursementToken';
import { MAX_REIMBURSEMENT_AMOUNT, type ReimbursementRequest } from '@/lib/payroll/reimbursementTypes';
import { prepareReimbursementImage } from './reimbursementImage';

function secret() {
  const value = process.env.PAYROLL_REIMBURSEMENT_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (value.length < 32) throw new PayrollError('Konfigurasi tautan reimbursement belum tersedia. Hubungi admin.', 503);
  return value;
}
export function reimbursementClaims(token: string, now = new Date()) {
  try { return verifyReimbursementToken(token, secret(), now); }
  catch (e) { if (e instanceof ReimbursementTokenError) throw new PayrollError(e.message, 410); throw e; }
}
export function createReimbursementLink(period: PeriodDocument, profileId: string, appUrl: string, now = new Date()): string {
  let base: URL;
  try { base = new URL(appUrl); } catch { throw new PayrollError('Alamat LMS untuk reimbursement belum tersedia.', 503); }
  if (base.username || base.password || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))) throw new PayrollError('Alamat LMS untuk reimbursement tidak valid.', 503);
  if (period.status !== 'DRAFT' || now.getTime() >= Date.parse(period.correction_deadline)) throw new PayrollError('Periode reimbursement sudah ditutup.', 410);
  const expiry = new Date(Math.min(Date.parse(period.correction_deadline), now.getTime() + REIMBURSEMENT_LINK_MAX_AGE_SECONDS * 1000));
  const url = new URL('/payroll/reimbursement', base.origin);
  // Fragments stay in the browser and never enter reverse-proxy request logs.
  url.hash = new URLSearchParams({ token: issueReimbursementToken(profileId, period.id, expiry, secret(), now) }).toString();
  return url.toString();
}
export async function reimbursementScope(token: string, now = new Date()) {
  const claims = reimbursementClaims(token, now);
  const [profile, period] = await Promise.all([dao.reimbursementProfile(claims.profileId), getPayrollPeriod(claims.periodId)]);
  if (!profile?.active || !period) throw new PayrollError('Tautan reimbursement tidak tersedia. Hubungi admin.', 410);
  if (period.document.status !== 'DRAFT' || now.getTime() >= Date.parse(period.document.correction_deadline)) throw new PayrollError('Pengajuan ditutup tanggal 25 pukul 17.00 WIB atau periode sudah final.', 410);
  return { claims, profile, period };
}
function publicRequest(request: ReimbursementRequest) {
  return { id: request.id, title: request.title, amount: Number(request.amount), status: request.status, submittedAt: request.created_at, reviewNote: request.review_reason };
}
function adminRequest(request: ReimbursementRequest, recipientName: string) {
  return { ...publicRequest(request), profileId: request.profile_id, recipientName, periodId: request.period_id, revision: request.revision, evidenceUrl: `/api/admin/payroll/reimbursements/${request.id}/evidence` };
}
export async function publicReimbursementMetadata(token: string, now = new Date()) {
  const { claims, profile, period } = await reimbursementScope(token, now);
  const requests = (await dao.listReimbursementRequests(claims.periodId, claims.profileId)).filter(row => row.profile_id === claims.profileId && row.period_id === claims.periodId);
  return { recipientName: profile.name, periodId: claims.periodId, periodLabel: new Date(Date.UTC(period.document.year, period.document.month - 1, 1)).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', month: 'long', year: 'numeric' }), deadline: period.document.correction_deadline, canSubmit: requests.length < 30, requests: requests.map(publicRequest) };
}
const submissionSchema = z.object({ submissionId: z.string().uuid(), title: z.string().transform(s => s.replace(/\s+/g, ' ').trim()).pipe(z.string().min(3).max(120)), amount: z.string().regex(/^[0-9]{1,10}$/).transform(Number).pipe(z.number().int().min(1).max(MAX_REIMBURSEMENT_AMOUNT)) });
export async function submitPublicReimbursement(token: string, form: FormData, now = new Date()) {
  const { claims } = await reimbursementScope(token, now);
  const parsed = submissionSchema.safeParse({ submissionId: form.get('submissionId'), title: form.get('title'), amount: form.get('amount') });
  if (!parsed.success) throw new PayrollError('Isi judul 3–120 karakter, nominal rupiah bulat yang valid, dan foto bukti.');
  const { submissionId, title, amount } = parsed.data;
  const [existing, count] = await Promise.all([dao.reimbursementRequest(submissionId), dao.reimbursementRequestCount(claims.periodId, claims.profileId)]);
  if (existing && (existing.profile_id !== claims.profileId || existing.period_id !== claims.periodId)) throw new PayrollError('Identitas pengajuan tidak dapat dipakai. Muat ulang formulir.', 409);
  if (!existing && count >= 30) throw new PayrollError('Batas 30 pengajuan per periode tercapai. Hubungi admin.', 429);
  const file = form.get('photo');
  if (!(file instanceof File)) throw new PayrollError('Foto bukti wajib diunggah.');
  const image = await prepareReimbursementImage(file);
  const contentHash = createHash('sha256').update(JSON.stringify([title.toLocaleLowerCase('id-ID'), amount])).update(image).digest('hex');
  if (existing) {
    if (existing.content_hash !== contentHash) throw new PayrollError('Pengajuan ini sudah terkirim dengan isi berbeda. Muat ulang formulir.', 409);
    return { request: publicRequest(existing) };
  }
  // Every attempt gets an immutable storage key. A DB-level idempotency match
  // returns the existing receipt and the unused candidate object is removed.
  const path = `${claims.periodId}/${claims.profileId}/${randomUUID()}.webp`;
  await dao.uploadReimbursementEvidence(path, image);
  let row: ReimbursementRequest;
  try {
    row = await dao.insertReimbursementRequest({ id: submissionId, profile_id: claims.profileId, period_id: claims.periodId, title, amount, evidence_path: path, evidence_bytes: image.length, content_hash: contentHash });
  } catch (e) {
    // A lost RPC response may follow a committed insert. Never delete its receipt.
    const persisted = await dao.reimbursementRequest(submissionId).catch(() => undefined);
    if (persisted !== undefined && persisted?.evidence_path !== path) await dao.deleteReimbursementEvidence(path).catch(() => console.error('[Reimbursement] Unused private evidence cleanup failed'));
    throw e;
  }
  if (row.evidence_path !== path) await dao.deleteReimbursementEvidence(path).catch(() => console.error('[Reimbursement] Duplicate private evidence cleanup failed'));
  return { request: publicRequest(row) };
}
export async function adminReimbursementList(periodId: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(periodId)) throw new PayrollError('Periode tidak valid.');
  return { requests: (await dao.listReimbursementRequests(periodId)).map(row => adminRequest(row, row.recipient_name)) };
}
const reviewSchema = z.object({ id: z.string().uuid(), revision: z.number().int().nonnegative(), status: z.enum(['APPROVED', 'REJECTED']), reason: z.string().trim().min(5).max(1000) });
export async function adminReviewReimbursement(input: unknown, actor: string) {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) throw new PayrollError('Pilih keputusan dan isi alasan minimal 5 karakter.');
  const row = await dao.reviewReimbursementRequest(parsed.data, actor);
  const profile = await dao.reimbursementProfile(row.profile_id);
  return { request: adminRequest(row, profile?.name ?? 'Penerima') };
}
export async function adminReimbursementEvidence(id: string) {
  if (!z.string().uuid().safeParse(id).success) throw new PayrollError('Foto bukti tidak ditemukan.', 404);
  const row = await dao.reimbursementRequest(id);
  if (!row) throw new PayrollError('Foto bukti tidak ditemukan.', 404);
  const expected = `${row.period_id}/${row.profile_id}/`;
  if (!row.evidence_path.startsWith(expected) || !/^[0-9]{4}-(0[1-9]|1[0-2])\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(row.evidence_path)) throw new PayrollError('Foto bukti tidak ditemukan.', 404);
  return dao.downloadReimbursementEvidence(row.evidence_path);
}
