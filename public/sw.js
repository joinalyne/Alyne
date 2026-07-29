/* Alyne service worker — minimal, safe-by-default.
 *
 * Strategy:
 *  - Navigations: network-first (so deploys are picked up), offline fallback to cached shell
 *  - Same-origin static assets: stale-while-revalidate
 *  - Versioned cache; old versions cleaned up on activate
 *
 * Push handlers live at the bottom of this file. The subscription flow is in
 * src/lib/push.ts.
 */
const VERSION = 'alyne-v2';
const SHELL = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase/API calls

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});

/* ── Push notifications ──────────────────────────────────────────────────────
 *
 * Built to Salomeh's Push Notification Spec. The server decides what to say and
 * when; this file only renders and routes, so copy changes never require a
 * service worker update (which users pick up slowly).
 *
 * Two rules from the spec are enforced here because only the client can:
 *  - collapsing, via `tag`. Several partner check-ins arriving while the device
 *    was offline must show as one, newest replacing rather than stacking.
 *  - deep linking, so tapping a notification opens the app rather than a new tab.
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Never surface a raw or malformed payload to a user.
    return;
  }

  const { title, body, tag, url } = payload;
  if (!title) return;

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body || '',
      // Same tag replaces rather than stacks, per the spec's offline rule.
      tag: tag || 'alyne',
      renotify: true,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Focus an existing window rather than opening a second copy of the app.
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

/* A subscription can be rotated by the browser without the user doing anything.
 * Without this the endpoint silently goes stale and notifications simply stop,
 * with nothing to indicate why. */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({ type: 'push-subscription-changed' });
      }
    })(),
  );
});
