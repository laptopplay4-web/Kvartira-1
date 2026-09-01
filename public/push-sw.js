/* global self, clients */

/**
 * ROADMAP 3.3 — Web Push handlers (imported by Workbox SW via importScripts).
 */

self.addEventListener('push', (event) => {
  let data = { title: 'Квартира', body: '', link: '/' };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = {
        title: parsed.title || data.title,
        body: parsed.body || '',
        link: parsed.link || '/',
      };
    } catch (_) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/assets/logo.png',
      badge: '/assets/logo.png',
      data: { link: data.link },
      tag: 'kvartira-notification',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          client.navigate(link);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(link);
      }
      return undefined;
    }),
  );
});
