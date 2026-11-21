'use client';

import { useEffect } from 'react';

import { syncExistingPushSubscriptionToCurrentAccount } from '@/lib/clientPushSubscription';

export default function PushSubscriptionAccountSync({ userId }: { userId: string }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let disposed = false;
    let running = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const sync = async () => {
      if (disposed || running || document.visibilityState === 'hidden') return;
      clearTimeout(retry);
      running = true;
      try {
        await syncExistingPushSubscriptionToCurrentAccount(userId);
        failures = 0;
      } catch (error) {
        console.warn('[Push] Account sync skipped', error);
        if (!disposed) retry = setTimeout(sync, Math.min(60_000, 5_000 * 2 ** Math.min(failures++, 4)));
      } finally {
        running = false;
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', sync);
    window.addEventListener('online', sync);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      disposed = true;
      clearTimeout(retry);
      navigator.serviceWorker.removeEventListener('controllerchange', sync);
      window.removeEventListener('online', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [userId]);

  return null;
}
