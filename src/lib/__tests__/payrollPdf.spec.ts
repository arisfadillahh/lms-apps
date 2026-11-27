import { afterEach, expect, it, vi } from 'vitest';
import { createPeriod, type Slip } from '@/lib/payroll/model';

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('node:fs', () => ({ default: { readFileSync: mocks.readFileSync, existsSync: mocks.existsSync } }));
vi.mock('puppeteer-core', () => ({ default: { launch: mocks.launch } }));

import { generatePayrollPdf } from '@/lib/pdf/generatePayrollPdf';

afterEach(() => vi.unstubAllEnvs());

it('uses the provisioned Chromium when no PDF browser or system Chromium is configured', async () => {
  for (const key of ['PUPPETEER_EXECUTABLE_PATH', 'CHROME_BIN', 'CHROMIUM_PATH']) vi.stubEnv(key, '');
  const executablePath = '/provisioned/chrome';
  mocks.existsSync.mockImplementation(candidate => candidate === executablePath);
  mocks.readFileSync.mockImplementation(filename => filename.endsWith('payment-browser.json')
    ? JSON.stringify({ executablePath })
    : Buffer.from('logo'));
  const close = vi.fn();
  mocks.launch.mockResolvedValue({
    close,
    newPage: async () => ({
      setJavaScriptEnabled: vi.fn(),
      setRequestInterception: vi.fn(),
      on: vi.fn(),
      setContent: vi.fn(),
      emulateMediaType: vi.fn(),
      pdf: async () => Buffer.from('%PDF-'),
    }),
  });
  const slip: Slip = {
    profile_id: 'staff-demo', user_id: null, kind: 'STAFF', name: 'Staf Demo', job_title: 'Staf',
    contract: 'FULLTIME', total: 100000, lines: [],
  };
  expect(await generatePayrollPdf(createPeriod(2026, 11), slip)).toEqual(Buffer.from('%PDF-'));
  expect(mocks.launch).toHaveBeenCalledWith(expect.objectContaining({ executablePath }));
  expect(close).toHaveBeenCalledOnce();
});
