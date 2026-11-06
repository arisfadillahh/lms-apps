import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { createPeriod, PayrollError } from '@/lib/payroll/model';
import { issueReimbursementToken, verifyReimbursementToken } from '@/lib/payroll/reimbursementToken';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ period: vi.fn(), profile: vi.fn(), list: vi.fn(), get: vi.fn(), count: vi.fn(), insert: vi.fn(), review: vi.fn(), upload: vi.fn(), remove: vi.fn(), download: vi.fn(), rate: vi.fn(), admin: vi.fn() }));
vi.mock('@/lib/dao/payrollDao', () => ({ getPayrollPeriod: mocks.period }));
vi.mock('@/lib/dao/payrollReimbursementsDao', () => ({ reimbursementProfile: mocks.profile, listReimbursementRequests: mocks.list, reimbursementRequest: mocks.get, reimbursementRequestCount: mocks.count, insertReimbursementRequest: mocks.insert, reviewReimbursementRequest: mocks.review, uploadReimbursementEvidence: mocks.upload, deleteReimbursementEvidence: mocks.remove, downloadReimbursementEvidence: mocks.download }));
vi.mock('@/lib/rateLimit', () => ({ consumeRateLimit: mocks.rate }));
vi.mock('@/lib/payroll/access', () => ({ payrollAdmin: mocks.admin }));
import { GET, POST } from '@/app/api/payroll/reimbursement/route';
import { GET as adminGET, POST as adminPOST } from '@/app/api/admin/payroll/reimbursements/route';
import { GET as evidenceGET } from '@/app/api/admin/payroll/reimbursements/[id]/evidence/route';
import { createReimbursementLink } from '@/lib/services/payrollReimbursements';

const profileId = '20000000-0000-4000-8000-000000000001';
const requestId = '30000000-0000-4000-8000-000000000001';
const secret = 'test-only-signing-secret-at-least-32-characters';
const now = new Date('2026-11-25T09:00:00+07:00');
const period = createPeriod(2026, 11);
const row = { id: requestId, profile_id: profileId, period_id: period.id, title: 'Beli bahan robotik', amount: 125000, evidence_path: `${period.id}/${profileId}/${requestId}.webp`, evidence_bytes: 1000, content_hash: 'a'.repeat(64), status: 'PENDING', revision: 0, created_at: now.toISOString(), reviewed_by: null, reviewed_at: null, review_reason: null, recipient_name: 'Staff Contoh' };
function token() { return issueReimbursementToken(profileId, period.id, new Date(period.correction_deadline), secret, now); }
function url() { return 'https://lms.clev.io/api/payroll/reimbursement'; }
function headers() { return { 'x-payroll-reimbursement-token': token() }; }
async function formRequest(patch: { title?: string; amount?: string; file?: File; submissionId?: string } = {}) {
  const photo = patch.file ?? new File([new Uint8Array(await sharp({ create: { width: 20, height: 20, channels: 3, background: '#cea' } }).png().toBuffer())], 'evidence.png', { type: 'image/png' });
  const form = new FormData(); form.set('title', patch.title ?? row.title); form.set('amount', patch.amount ?? String(row.amount)); form.set('submissionId', patch.submissionId ?? requestId); form.set('photo', photo);
  return new Request(url(), { method: 'POST', headers: headers(), body: form });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.unstubAllEnvs(); vi.stubEnv('PAYROLL_REIMBURSEMENT_SECRET', secret);
  vi.useFakeTimers(); vi.setSystemTime(now);
  mocks.period.mockResolvedValue({ id: period.id, revision: 1, document: { ...period, slips: [{ total: 7000000 }] } });
  mocks.profile.mockResolvedValue({ id: profileId, name: 'Staff Contoh', kind: 'STAFF', active: true });
  mocks.list.mockResolvedValue([row]); mocks.get.mockResolvedValue(null); mocks.count.mockResolvedValue(0);
  mocks.insert.mockImplementation(async input => ({ ...row, ...input })); mocks.review.mockResolvedValue({ ...row, status: 'APPROVED', revision: 1 });
  mocks.upload.mockResolvedValue(undefined); mocks.remove.mockResolvedValue(undefined); mocks.download.mockResolvedValue(new Uint8Array([1,2,3]).buffer);
  mocks.rate.mockResolvedValue(true); mocks.admin.mockResolvedValue({ user: { id: 'admin-id' } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('public reimbursement capability and private receipt handling', () => {
  it('returns only recipient/period metadata and their own reimbursement requests, never salary or evidence paths', async () => {
    mocks.list.mockResolvedValue([row, { ...row, id: 'other-request', profile_id: 'other-profile', title: 'Private other reimbursement' }]);
    const response = await GET(new Request(url(), { headers: headers() }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ recipientName: 'Staff Contoh', periodId: '2026-11', deadline: period.correction_deadline, canSubmit: true });
    expect(body.requests).toHaveLength(1); expect(body.requests[0]).toMatchObject({ id: requestId, amount: 125000 });
    expect(JSON.stringify(body)).not.toMatch(/7000000|evidence_path|content_hash|other-profile|Private other|staff_phone|total/);
    expect(mocks.list).toHaveBeenCalledWith(period.id, profileId);
    expect(response.headers.get('referrer-policy')).toBe('no-referrer'); expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('rejects a forged/expired token, inactive profile or final period before reading/storing evidence', async () => {
    expect((await GET(new Request(url(), { headers: { 'x-payroll-reimbursement-token': 'bad' } }))).status).toBe(410);
    mocks.profile.mockResolvedValue({ id: profileId, active: false });
    expect((await POST(await formRequest())).status).toBe(410);
    mocks.profile.mockResolvedValue({ id: profileId, active: true }); mocks.period.mockResolvedValue({ id: period.id, revision: 1, document: { ...period, status: 'FINAL' } });
    expect((await POST(await formRequest())).status).toBe(410);
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('stores a sanitized immutable WebP only after all validation and scopes the insert', async () => {
    const response = await POST(await formRequest({ title: '  Beli  bahan\nrobotik  ' }));
    expect(response.status).toBe(201); expect((await response.json()).request).toMatchObject({ title: row.title, amount: 125000, status: 'PENDING' });
    expect(mocks.upload).toHaveBeenCalledWith(expect.stringMatching(/^2026-11\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/), expect.any(Buffer));
    expect((await sharp(mocks.upload.mock.calls[0][1]).metadata()).format).toBe('webp');
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ id: requestId, profile_id: profileId, period_id: '2026-11', title: row.title, amount: 125000, content_hash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
  });
  it.each(['-1', '0', '1.5', '1e4', 'Rp125.000', '1000000001'])('rejects non-positive/non-integer/over-limit amount %s without storing evidence', async amount => {
    expect((await POST(await formRequest({ amount }))).status).toBe(400); expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('deduplicates an exact submission retry without storing another file and rejects changed content under the same id', async () => {
    await POST(await formRequest());
    const saved = mocks.insert.mock.calls[0][0]; mocks.get.mockResolvedValue({ ...row, ...saved });
    expect((await POST(await formRequest())).status).toBe(201); expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect((await POST(await formRequest({ amount: '126000' }))).status).toBe(409); expect(mocks.upload).toHaveBeenCalledTimes(1);
  });
  it('preserves committed evidence after an ambiguous lost insert response', async () => {
    mocks.insert.mockImplementation(async input => { mocks.get.mockResolvedValue({ ...row, ...input }); throw new Error('Lost network response after commit'); });
    expect((await POST(await formRequest())).status).toBe(500);
    expect(mocks.upload).toHaveBeenCalledTimes(1); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('rejects rate and period limits before decoding/storing photos', async () => {
    mocks.rate.mockResolvedValue(false);
    expect((await POST(await formRequest())).status).toBe(429); expect(mocks.profile).not.toHaveBeenCalled();
    mocks.rate.mockResolvedValue(true); mocks.count.mockResolvedValue(30);
    expect((await POST(await formRequest({ file: new File(['broken'], 'bad.png', { type: 'image/png' }) }))).status).toBe(429);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('builds a recipient-specific link from the trusted origin with an expiring token', () => {
    const link = new URL(createReimbursementLink(period, profileId, 'https://lms.clev.io/admin', now));
    expect(link.pathname).toBe('/payroll/reimbursement'); expect(link.search).toBe('');
    const capability = new URLSearchParams(link.hash.slice(1)).get('token')!;
    expect(verifyReimbursementToken(capability, secret, now)).toMatchObject({ profileId, periodId: period.id });
    expect(() => createReimbursementLink(period, profileId, 'javascript:alert(1)', now)).toThrow();
    expect(() => createReimbursementLink(period, profileId, 'https://user:password@lms.clev.io', now)).toThrow();
  });
  it('requires the private capability header, ignores query tokens and does not require an LMS login', async () => {
    expect((await GET(new Request(`${url()}?token=${token()}`))).status).toBe(410);
    expect((await GET(new Request(`${url()}?token=${token()}`, { headers: { 'x-payroll-reimbursement-token': 'invalid' } }))).status).toBe(410);
    const request = new Request(url(), { headers: headers() });
    expect(request.headers.has('cookie')).toBe(false); expect(request.headers.has('authorization')).toBe(false); expect(new URL(request.url).search).toBe('');
    expect((await GET(request)).status).toBe(200);
    expect((await POST(await formRequest())).status).toBe(201);
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.list).toHaveBeenCalledWith(period.id, profileId);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ profile_id: profileId, period_id: period.id }));
  });
});

describe('admin/finance-only reimbursement review and evidence', () => {
  it.each([401, 403])('rejects missing authorization (%s) before listing/reviewing/downloading receipts', async status => {
    mocks.admin.mockRejectedValue(new PayrollError('Akses ditolak.', status));
    expect((await adminGET(new Request('https://lms.clev.io/api/admin/payroll/reimbursements?period=2026-11'))).status).toBe(status);
    expect((await adminPOST(new Request('https://lms.clev.io/api/admin/payroll/reimbursements', { method: 'POST', body: '{}' }))).status).toBe(status);
    expect((await evidenceGET(new Request('https://lms.clev.io'), { params: Promise.resolve({ id: requestId }) })).status).toBe(status);
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.review).not.toHaveBeenCalled(); expect(mocks.download).not.toHaveBeenCalled();
  });
  it('exposes only an authenticated evidence endpoint and validates revision/reason for review', async () => {
    const response = await adminGET(new Request('https://lms.clev.io/api/admin/payroll/reimbursements?period=2026-11'));
    const body = await response.json(); expect(body.requests[0].evidenceUrl).toBe(`/api/admin/payroll/reimbursements/${requestId}/evidence`);
    expect(JSON.stringify(body)).not.toMatch(/evidence_path|content_hash/);
    const request = new Request('https://lms.clev.io/api/admin/payroll/reimbursements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: requestId, revision: 0, status: 'APPROVED', reason: 'Bukti sudah diperiksa' }) });
    expect((await adminPOST(request)).status).toBe(200); expect(mocks.review).toHaveBeenCalledWith({ id: requestId, revision: 0, status: 'APPROVED', reason: 'Bukti sudah diperiksa' }, 'admin-id');
  });
  it('streams a private WebP only after authorization and rejects evidence paths outside its immutable scope', async () => {
    mocks.get.mockResolvedValue(row);
    const response = await evidenceGET(new Request('https://lms.clev.io'), { params: Promise.resolve({ id: requestId }) });
    expect(response.status).toBe(200); expect(response.headers.get('Content-Type')).toBe('image/webp'); expect(response.headers.get('Cache-Control')).toContain('no-store');
    mocks.get.mockResolvedValue({ ...row, evidence_path: '../../other-secret' });
    expect((await evidenceGET(new Request('https://lms.clev.io'), { params: Promise.resolve({ id: requestId }) })).status).toBe(404);
    expect(mocks.download).toHaveBeenCalledTimes(1);
  });
});
