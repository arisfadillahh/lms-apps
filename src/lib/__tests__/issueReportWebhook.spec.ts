import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sendIssueReportWebhook, type IssueReportWebhookPayload } from '@/lib/services/issueReportWebhook';

const payload: IssueReportWebhookPayload = {
  event: 'lms_report',
  report_id: 'report-123',
  title: 'Tombol gagal',
  description: 'Tombol simpan tidak merespons',
  reporter: { id: 'user-123', name: 'Coach Test', role: 'COACH' },
  page_url: '/coach/classes/example',
  user_agent: 'Test Browser',
  viewport: { width: 1280, height: 720 },
  screenshot: { url: 'https://storage.example/signed', storage_path: 'issue-reports/report-123.png', note: 'Signed URL expires after 1 hour.' },
  timestamp: '2026-09-25T00:00:00.000Z',
};

describe('issue report webhook', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.LMS_REPORT_WEBHOOK_URL;
    delete process.env.LMS_REPORT_WEBHOOK_SECRET;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.LMS_REPORT_WEBHOOK_URL;
    delete process.env.LMS_REPORT_WEBHOOK_SECRET;
  });

  it('skips delivery when URL is missing', async () => {
    await sendIssueReportWebhook(payload);
    expect(fetch).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Skipped'), { reportId: payload.report_id });
  });

  it('posts the report with a Bearer Authorization header', async () => {
    process.env.LMS_REPORT_WEBHOOK_URL = 'https://bot.example/webhook';
    process.env.LMS_REPORT_WEBHOOK_SECRET = 'test-secret';
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200 } as Response);

    await sendIssueReportWebhook(payload);

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.stringify(payload);
    expect(String(url)).toBe(process.env.LMS_REPORT_WEBHOOK_URL);
    expect(options?.method).toBe('POST');
    expect(options?.body).toBe(body);
    expect(options?.headers).toEqual({
      'content-type': 'application/json',
      Authorization: 'Bearer test-secret',
    });
    expect(options?.signal).toBeDefined();
  });

  it('accepts a full Authorization header value without duplicating Bearer', async () => {
    process.env.LMS_REPORT_WEBHOOK_URL = 'https://bot.example/webhook';
    process.env.LMS_REPORT_WEBHOOK_SECRET = 'Authorization: Bearer test-secret';
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200 } as Response);

    await sendIssueReportWebhook(payload);

    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toEqual({
      'content-type': 'application/json',
      Authorization: 'Bearer test-secret',
    });
  });

  it('logs HTTP failure without rejecting the saved report flow', async () => {
    process.env.LMS_REPORT_WEBHOOK_URL = 'https://bot.example/webhook';
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response);

    await expect(sendIssueReportWebhook(payload)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Delivery failed'), { reportId: payload.report_id, status: 503 });
  });
});
