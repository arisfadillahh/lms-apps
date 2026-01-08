import type { WhatsappLogRecord } from '@/lib/dao/reportsDao';

type WhatsappCategory = WhatsappLogRecord['category'];

type SendParentAbsentPayload = {
  coderFullName: string;
  className: string;
  sessionDateTime: string;
  makeUpUrl: string;
  parentPhone: string;
  status: 'ABSENT' | 'EXCUSED';
  reason?: string | null;
  instructions?: string | null;
  dueDate?: string | null;
  reminderType?: 'H-3' | 'H-1' | 'INITIAL';
};

type SendReportPayload = {
  coderFullName: string;
  className: string;
  pdfUrl: string;
  parentPhone: string;
};

type WhatsappStatusResponse = {
  status: 'ONLINE' | 'OFFLINE' | 'INITIALIZING';
  queued: number;
  connectedNumber?: string;
};

function getWorkerUrl(): string {
  const url = process.env.WA_WORKER_URL;
  if (!url) {
    throw new Error('Missing WA_WORKER_URL');
  }
  return url.replace(/\/$/, '');
}

async function postJson<TBody extends object, TResponse = unknown>(path: string, body: TBody): Promise<TResponse> {
  const url = `${getWorkerUrl()}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`WhatsApp worker error (${response.status}): ${payload}`);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export async function sendParentAbsent(payload: SendParentAbsentPayload) {
  return postJson('/send/parent-absent', payload);
}

export async function sendReport(payload: SendReportPayload) {
  return postJson('/send/report', payload);
}

export async function getStatus(): Promise<WhatsappStatusResponse> {
  const url = `${getWorkerUrl()}/status`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch WhatsApp status (${response.status})`);
  }
  return (await response.json()) as WhatsappStatusResponse;
}

export async function requestConnection() {
  return postJson('/connect', {});
}
