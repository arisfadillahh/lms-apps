import type { IssueReporterRole } from '@/lib/issueReports';

export type IssueReportWebhookPayload = {
  event: 'lms_report';
  report_id: string;
  title: string;
  description: string;
  reporter: { id: string; name: string; role: IssueReporterRole };
  page_url: string | null;
  user_agent: string | null;
  viewport: { width: number | null; height: number | null };
  screenshot: {
    url: string | null;
    storage_path: string | null;
    note: string | null;
  };
  timestamp: string;
};

export async function sendIssueReportWebhook(payload: IssueReportWebhookPayload): Promise<void> {
  const webhookUrl = process.env.LMS_REPORT_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.info('[IssueReportWebhook] Skipped: LMS_REPORT_WEBHOOK_URL is not set', { reportId: payload.report_id });
    return;
  }

  try {
    const url = new URL(webhookUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Webhook URL must use HTTP(S)');

    const body = JSON.stringify(payload);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const secret = process.env.LMS_REPORT_WEBHOOK_SECRET?.trim();
    if (secret) {
      const authorization = secret.replace(/^Authorization:\s*/i, '');
      headers.Authorization = /^Bearer\s+/i.test(authorization) ? authorization : `Bearer ${authorization}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error('[IssueReportWebhook] Delivery failed', { reportId: payload.report_id, status: response.status });
    }
  } catch (error) {
    console.error('[IssueReportWebhook] Delivery error', {
      reportId: payload.report_id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
