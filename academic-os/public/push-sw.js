/**
 * Academic OS — handler de Web Push.
 *
 * No es un service worker completo: Workbox (vite-plugin-pwa, generateSW) lo
 * carga dentro del sw.js generado vía `workbox.importScripts`. Así no hay que
 * migrar a injectManifest ni mantener el precache a mano.
 */

const ICON = '/icons/gerardex-192.png';

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Academic OS';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: ICON,
      badge: ICON,
      tag: data.tag || 'academic-os',
      renotify: true,
      requireInteraction: !!data.requireInteraction,
      vibrate: [120, 60, 120],
      actions: Array.isArray(data.actions) ? data.actions : [],
      data: { url: data.url || '/', ackUrl: data.ackUrl || null },
    }),
  );
});

async function openApp(url) {
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of all) {
    if ('focus' in client) {
      client.postMessage({ type: 'aos-push-nav', url });
      return client.focus();
    }
  }
  return self.clients.openWindow(url);
}

self.addEventListener('notificationclick', (event) => {
  const info = event.notification.data || {};
  event.notification.close();

  // [Después] solo silencia. [Sí] avisa al servidor para que deje de insistir
  // por ese bloque; el XP se marca en la app cuando el usuario la abra.
  if (event.action === 'later') return;
  if (event.action === 'done' && info.ackUrl) {
    event.waitUntil(fetch(info.ackUrl, { method: 'POST' }).catch(() => {}));
    return;
  }
  event.waitUntil(openApp(info.url || '/'));
});

// Android puede rotar la suscripción sola. Sin esto, los push mueren en
// silencio para siempre.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch('/api/push/public-key');
        const { key } = await res.json();
        if (!key) return;
        const sub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: Uint8Array.from(
            atob(key.replace(/-/g, '+').replace(/_/g, '/')),
            (c) => c.charCodeAt(0),
          ),
        });
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
        });
      } catch {
        /* sin red: se re-suscribe al abrir la app */
      }
    })(),
  );
});
