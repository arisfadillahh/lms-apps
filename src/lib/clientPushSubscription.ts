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
  let subscription = await registration.pushManager.getSubscription();
  const keyResponse = await fetch('/api/push/vapid-public-key', { cache: 'no-store' });
  if (!keyResponse.ok) throw new Error('Push public key could not be loaded');
  const { enabled, publicKey } = await keyResponse.json();
  if (!enabled || typeof publicKey !== 'string' || !publicKey) return;

  const base64 = publicKey.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(publicKey.length / 4) * 4, '=');
  const key = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const oldKey = subscription?.options.applicationServerKey;
  const keyChanged = oldKey && (
    oldKey.byteLength !== key.length || new Uint8Array(oldKey).some((byte, index) => byte !== key[index])
  );
  const expiresAt = subscription?.expirationTime;
  if (subscription && (keyChanged || (expiresAt != null && expiresAt <= Date.now()))) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });

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
