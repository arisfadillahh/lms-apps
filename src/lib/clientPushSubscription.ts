async function setServiceWorkerActiveUser(userId: string | null) {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: 'SET_ACTIVE_USER', userId });
}

export async function syncExistingPushSubscriptionToCurrentAccount(userId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
  await setServiceWorkerActiveUser(userId);
  if (Notification.permission !== 'granted') return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw new Error('Push subscription account sync failed');
}

export async function detachPushSubscriptionFromCurrentAccount() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  await setServiceWorkerActiveUser(null);

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const response = await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
    keepalive: true,
  });
  if (!response.ok) {
    await subscription.unsubscribe().catch(() => false);
    throw new Error('Push subscription account detach failed');
  }
}
