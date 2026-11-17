'use client';

import { useEffect } from 'react';

import { syncExistingPushSubscriptionToCurrentAccount } from '@/lib/clientPushSubscription';

export default function PushSubscriptionAccountSync({ userId }: { userId: string }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const sync = () => {
      syncExistingPushSubscriptionToCurrentAccount(userId).catch((error) => {
        console.warn('[Push] Account sync skipped', error);
      });
    };
    navigator.serviceWorker.addEventListener('controllerchange', sync);
    sync();
    return () => navigator.serviceWorker.removeEventListener('controllerchange', sync);
  }, [userId]);

  return null;
}
