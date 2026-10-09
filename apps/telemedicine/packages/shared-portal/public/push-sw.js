/* Sabi phone and computer notifications. Imported into the generated service worker (pwaOptions
 * `importScripts`), so it runs even when Sabi is closed.
 * - push: shows the notification Sabi sent (text already follows the patient's privacy choice).
 * - Taken / Remind me later on a medicine reminder: answered without opening the app, using the
 *   signed token in the notification, then a short confirmation replaces the reminder.
 * - Tapping the notification opens (or focuses) Sabi on the right page. */
/* eslint-env serviceworker */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  const scope = self.registration.scope;
  event.waitUntil(self.registration.showNotification(data.title || 'Sabi Health', {
    body: data.body || '',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    requireInteraction: Boolean(data.requireInteraction),
    icon: `${scope}pwa-192x192.png`,
    badge: `${scope}pwa-64x64.png`,
    actions: Array.isArray(data.actions) ? data.actions.slice(0, 2) : [],
    data: { url: data.url || '/', actionToken: data.actionToken || null },
  }));
});

const appUrl = (path) => new URL(String(path || '/').replace(/^\//, ''), self.registration.scope).href;

async function openSabi(path) {
  const target = appUrl(path);
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const open = windows.find((client) => client.url.startsWith(self.registration.scope));
  if (open) {
    await open.focus();
    return open.navigate ? open.navigate(target).catch(() => undefined) : undefined;
  }
  return self.clients.openWindow(target);
}

async function answer(action, token, tag) {
  let message = 'Open Sabi to record this dose.';
  try {
    const response = await fetch(new URL('/api/v1/notifications/push/action', self.location.origin).href, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Sabi-Client': 'browser' },
      body: JSON.stringify({ token, action }),
    });
    const body = await response.json().catch(() => ({}));
    message = body?.data?.message || body?.message || message;
  } catch { /* offline: say so below */ message = 'You seem to be offline. Open Sabi to record this dose.'; }
  return self.registration.showNotification('Sabi Health', { body: message, tag, icon: `${self.registration.scope}pwa-192x192.png`, badge: `${self.registration.scope}pwa-64x64.png` });
}

self.addEventListener('notificationclick', (event) => {
  const { url, actionToken } = event.notification.data || {};
  const tag = event.notification.tag;
  event.notification.close();
  if ((event.action === 'taken' || event.action === 'snooze') && actionToken) {
    event.waitUntil(answer(event.action, actionToken, tag));
    return;
  }
  event.waitUntil(openSabi(url));
});
