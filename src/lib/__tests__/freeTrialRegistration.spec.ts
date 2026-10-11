import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  notifyAdmins: vi.fn(),
  send: vi.fn(),
  rateLimit: vi.fn(),
  pending: [] as Array<() => Promise<void>>,
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: (callback: () => Promise<void>) => mocks.pending.push(callback) };
});
vi.mock('@/lib/dao/trialClassDao', () => ({ createTrialClassSubmission: mocks.create }));
vi.mock('@/lib/dao/notificationsDao', () => ({ createAdminNotifications: mocks.notifyAdmins }));
vi.mock('@/lib/services/trialClassNotifications', () => ({ sendTrialClassNotifications: mocks.send }));
vi.mock('@/lib/rateLimit', () => ({ consumeRateLimit: mocks.rateLimit }));

import { POST } from '@/app/api/free-trial/route';

const payload = {
  studentName: 'Trial Test', studentGrade: '4 SD', schoolName: 'Sekolah Test',
  parentName: 'Orang Tua Test', phone: '081234567890', email: 'test@example.com',
  trialMode: 'ONLINE', domicile: '  Kota Depok  ', notes: '', website: '',
};

function request(body: unknown) {
  return new Request('https://example.com/api/free-trial', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pending.length = 0;
  mocks.rateLimit.mockResolvedValue(true);
  mocks.create.mockImplementation(async (input) => ({
    ...input, id: 'trial-test', created_at: '2026-10-10T08:00:00Z',
  }));
  mocks.send.mockResolvedValue({ adminGroup: { success: true }, parent: { success: true } });
});

describe('free trial registration domicile', () => {
  it('persists trimmed domicile before sending the saved value to notifications', async () => {
    const response = await POST(request(payload));
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ domicile: 'Kota Depok' }));
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.pending).toHaveLength(1);
    await mocks.pending[0]();
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ domicile: 'Kota Depok' }));
  });

  it('keeps older form submissions compatible with a null domicile', async () => {
    expect((await POST(request({ ...payload, domicile: undefined }))).status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ domicile: null }));
  });

  it.each(['', 'A'.repeat(161)])('rejects invalid domicile without saving or messaging', async (domicile) => {
    const response = await POST(request({ ...payload, domicile }));
    expect(response.status).toBe(400);
    expect((await response.json()).fieldErrors.domicile).toBeDefined();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.notifyAdmins).not.toHaveBeenCalled();
    expect(mocks.pending).toHaveLength(0);
  });

  it('retains the registration rate limit', async () => {
    mocks.rateLimit.mockResolvedValue(false);
    expect((await POST(request(payload))).status).toBe(429);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
