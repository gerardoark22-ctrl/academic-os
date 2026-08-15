/**
 * Service worker escrito a mano (sin vite-plugin-pwa, sin librerías de Firebase).
 *
 * Hace tres cosas:
 *   1. Muestra las notificaciones push que manda FCM (Push API nativa, sin SDK).
 *   2. Abre la app al tocar la notificación.
 *   3. Cachea el cascarón para que la PWA sea instalable y abra sin señal.
 *
 * El bundle de Vite lleva hash en el nombre, así que aquí solo se precachea el
 * cascarón fijo; el resto se guarda en caché a medida que se pide (network-first
 * para no servir un bundle viejo tras un deploy).
 */

const CACHE = 'aos-v1';
const SHELL = ['/', '/index.html', '/manifest.json', '/icons/gerardex-192.png', '/icons/gerardex-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first para lo propio: siempre la versión fresca, y el caché solo como
// red de seguridad cuando no hay internet.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((c) => c || caches.match('/index.html')),
      ),
  );
});

self.addEventListener('push', (e) => {
  let datos = {};
  try {
    datos = e.data.json();
  } catch {
    /* payload vacío o no-JSON: se usan los textos por defecto */
  }
  const n = datos.notification || datos;
  const titulo = n.title || 'Academic OS';
  const cuerpo = n.body || '';
  e.waitUntil(
    self.registration.showNotification(titulo, {
      body: cuerpo,
      icon: '/icons/gerardex-192.png',
      badge: '/icons/gerardex-192.png',
      vibrate: [80, 40, 80],
      // Sin tag: dos avisos distintos del mismo día no deben pisarse.
      data: { url: (datos.data && datos.data.url) || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      const abierta = lista.find((c) => 'focus' in c);
      if (abierta) {
        abierta.navigate(destino).catch(() => {});
        return abierta.focus();
      }
      return self.clients.openWindow(destino);
    }),
  );
});
