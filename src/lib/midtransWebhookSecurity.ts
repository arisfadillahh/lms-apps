import 'server-only';

import crypto from 'node:crypto';
import type { MidtransNotificationPayload } from '@/lib/invoiceMidtransClient';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const STORED_NOTIFICATION_FIELDS = [
  'order_id',
  'transaction_id',
  'transaction_status',
  'transaction_time',
  'settlement_time',
  'payment_type',
  'status_code',
  'status_message',
  'fraud_status',
  'gross_amount',
  'currency',
] as const;

export function buildMidtransWebhookEventKey(payload: MidtransNotificationPayload): string {
  const stableEvent = [
    payload.order_id,
    payload.transaction_id,
    payload.status_code,
    payload.transaction_status,
    payload.fraud_status,
    payload.gross_amount,
    payload.settlement_time,
  ].map((value) => String(value ?? '')).join('|');
  return crypto.createHash('sha256').update(stableEvent).digest('hex');
}

export function sanitizeMidtransNotificationPayload(
  payload: MidtransNotificationPayload,
): MidtransNotificationPayload {
  const safe: Record<string, unknown> = {};
  const source = payload as Record<string, unknown>;
  for (const field of STORED_NOTIFICATION_FIELDS) {
    if (source[field] !== undefined) safe[field] = source[field];
  }
  return safe as MidtransNotificationPayload;
}

export async function claimMidtransWebhookEvent(
  eventKey: string,
  payload: MidtransNotificationPayload,
): Promise<'CLAIMED' | 'DUPLICATE' | 'IN_PROGRESS'> {
  const { data, error } = await getSupabaseAdmin().rpc('claim_midtrans_webhook_event' as never, {
    p_event_key: eventKey,
    p_order_id: String(payload.order_id ?? ''),
    p_transaction_id: payload.transaction_id ?? null,
    p_transaction_status: payload.transaction_status ?? null,
  } as never);
  if (error || (data !== 'CLAIMED' && data !== 'DUPLICATE' && data !== 'IN_PROGRESS')) {
    throw new Error(`Failed to claim Midtrans webhook: ${error?.message || 'invalid ledger response'}`);
  }
  return data;
}

export async function finishMidtransWebhookEvent(
  eventKey: string,
  state: 'PROCESSED' | 'FAILED',
  failureReason?: string,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('midtrans_webhook_events' as never)
    .update({
      state,
      failure_reason: state === 'FAILED' ? (failureReason || 'Unknown processing failure').slice(0, 1000) : null,
      processed_at: state === 'PROCESSED' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('event_key', eventKey);
  if (error) throw new Error(`Failed to finalize Midtrans webhook ledger: ${error.message}`);
}
