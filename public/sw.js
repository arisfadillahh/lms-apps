const CACHE_NAME = 'clevio-lms-shell-v5';
const OFFLINE_URL = '/offline.html';
const ACTIVE_USER_CACHE = 'clevio-active-user';
const ACTIVE_USER_KEY = '/__clevio_active_user__';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([
        OFFLINE_URL,
        '/logo/innovator-camp-logo-dark.png',
        '/pwa-icon-192.png',
        '/pwa-icon-full-192.png',
      ]))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME && key !== ACTIVE_USER_CACHE)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SET_ACTIVE_USER') return;
  event.waitUntil((async () => {
    const cache = await caches.open(ACTIVE_USER_CACHE);
    if (!event.data.userId) {
      await cache.delete(ACTIVE_USER_KEY);
      return;
    }
    await cache.put(ACTIVE_USER_KEY, new Response(String(event.data.userId)));
  })());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const title = payload.title || 'Notifikasi Clevio LMS';
  const options = {
    body: payload.body || 'Ada informasi baru di LMS.',
    icon: '/pwa-icon-full-192.png',
    badge: '/pwa-icon-full-192.png',
    data: { url: payload.url || '/' },
    tag: payload.tag || 'clevio-lms-notification',
    renotify: true,
  };
  event.waitUntil((async () => {
    if (payload.recipientUserId) {
      const cache = await caches.open(ACTIVE_USER_CACHE);
      const activeUserResponse = await cache.match(ACTIVE_USER_KEY);
      const activeUserId = activeUserResponse ? await activeUserResponse.text() : null;
      if (!activeUserId || activeUserId !== String(payload.recipientUserId)) return;
    }
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clients.find((client) => 'focus' in client);
    if (existing) {
      await existing.focus();
      if ('navigate' in existing) await existing.navigate(targetUrl);
      return;
    }
    await self.clients.openWindow(targetUrl);
  })());
});
