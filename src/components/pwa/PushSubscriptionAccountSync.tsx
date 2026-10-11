'use client';

import { useEffect } from 'react';

import { syncExistingPushSubscriptionToCurrentAccount } from '@/lib/clientPushSubscription';

export default function PushSubscriptionAccountSync({ userId }: { userId: string }) {
  useEffect(() => {
    syncExistingPushSubscriptionToCurrentAccount(userId).catch((error) => {
      console.warn('[Push] Account sync skipped', error);
    });
  }, [userId]);

  return null;
}
