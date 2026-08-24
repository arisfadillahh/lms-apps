'use client';

import { useEffect } from 'react';

import { syncExistingPushSubscriptionToCurrentAccount } from '@/lib/clientPushSubscription';

export default function PushSubscriptionAccountSync() {
  useEffect(() => {
    syncExistingPushSubscriptionToCurrentAccount().catch((error) => {
      console.warn('[Push] Account sync skipped', error);
    });
  }, []);

  return null;
}
