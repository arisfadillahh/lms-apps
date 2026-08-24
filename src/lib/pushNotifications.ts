import 'server-only';

import webpush from 'web-push';

import { getSupabaseAdmin } from '@/lib/supabaseServer';

type PushSubscriptionRecord = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};

function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@clevio.co';
  if (!publicKey || !privateKey) return null;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { publicKey };
}

export function getVapidPublicKey(): string | null {
  return getVapidConfig()?.publicKey ?? null;
}

export async function savePushSubscription(userId: string, subscription: PushSubscriptionRecord, userAgent?: string | null) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('push_subscriptions' as any).upsert({
    user_id: userId,
    endpoint: subscription.endpoint,
    subscription,
    user_agent: userAgent?.slice(0, 500) || null,
  }, { onConflict: 'endpoint' } as any);
  if (error) throw new Error(`Failed to save push subscription: ${error.message}`);
}

export async function removePushSubscription(userId: string, endpoint: string) {
  const { error } = await getSupabaseAdmin().from('push_subscriptions' as any)
    .delete().eq('user_id', userId).eq('endpoint', endpoint);
  if (error) throw new Error(`Failed to remove push subscription: ${error.message}`);
}

export async function sendPushToUsers(userIds: string[], payload: { title: string; body: string; url?: string; tag?: string }) {
  const config = getVapidConfig();
  if (!config || userIds.length === 0) return { sent: 0, removed: 0, skipped: true };

  const { data, error } = await getSupabaseAdmin().from('push_subscriptions' as any)
    .select('id,user_id,endpoint,subscription').in('user_id', userIds);
  if (error) throw new Error(`Failed to load push subscriptions: ${error.message}`);

  let sent = 0;
  let removed = 0;
  for (const row of (data ?? []) as unknown as Array<{ id: string; user_id: string; subscription: PushSubscriptionRecord }>) {
    try {
      await webpush.sendNotification(row.subscription as webpush.PushSubscription, JSON.stringify({
        ...payload,
        recipientUserId: row.user_id,
      }));
      sent += 1;
    } catch (caught) {
      const statusCode = (caught as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await getSupabaseAdmin().from('push_subscriptions' as any).delete().eq('id', row.id);
        removed += 1;
      } else {
        console.error('[Push] Delivery failed', caught);
      }
    }
  }
  return { sent, removed, skipped: false };
}
