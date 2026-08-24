import 'server-only';

import crypto from 'crypto';

import { getSupabaseAdmin } from '@/lib/supabaseServer';

function getClientAddress(request: Request): string {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

export async function consumeRateLimit(input: {
  request: Request;
  scope: string;
  maxRequests: number;
  windowSeconds: number;
  actorId?: string | null;
}): Promise<boolean> {
  const identity = input.actorId || getClientAddress(input.request);
  const keyHash = crypto.createHash('sha256').update(`${input.scope}:${identity}`).digest('hex');
  const { data, error } = await getSupabaseAdmin().rpc('consume_api_rate_limit' as never, {
    p_key_hash: keyHash,
    p_scope: input.scope,
    p_window_seconds: input.windowSeconds,
    p_max_requests: input.maxRequests,
  } as never);
  if (error) {
    console.error('[RateLimit] Failed closed', { scope: input.scope, message: error.message });
    return false;
  }
  return data === true;
}
