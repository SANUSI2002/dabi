// An explicit display action, not a push subscription and not a repeating background job.
export const EMERGENCY_NOTIFICATION_TAG = 'sabi-emergency-card';
export function emergencyAccessUrl(code, origin = window.location.origin, base = import.meta.env.BASE_URL || '/') {
  const url = new URL(`${base.replace(/\/?$/, '/')}emergency-access`, origin);
  // Fragment identifiers never go to the web server's URL/access logs.
  url.hash = new URLSearchParams({ code }).toString();
  return url.href;
}
export function notificationSupport() {
  if (typeof window === 'undefined') return { available: false, permission: 'unavailable' };
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true;
  if (!window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator)) return { available: false, permission: 'unavailable', installRequired: ios && !installed };
  return { available: !ios || installed, permission: window.Notification.permission, installRequired: ios && !installed };
}
async function registration() {
  const current = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL || '/');
  if (!current?.active) throw new Error('The app is getting ready. Refresh Sabi and try again.');
  return current;
}
export async function closeEmergencyNotification() {
  if (!('serviceWorker' in navigator)) return;
  const current = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL || '/');
  if (current?.getNotifications) (await current.getNotifications({ tag: EMERGENCY_NOTIFICATION_TAG })).forEach((n) => n.close());
}
// Refresh only a card that is still visible on this device. Never request permission or
// recreate a dismissed card on page load/name changes. Offline devices may retain an old code.
export async function syncVisibleEmergencyNotification(card) {
  if (!card.notificationEnabled) return closeEmergencyNotification();
  if (!notificationSupport().available || Notification.permission !== 'granted') return;
  const current = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL || '/');
  if (!current?.active || !current.getNotifications) return;
  const visible = await current.getNotifications({ tag: EMERGENCY_NOTIFICATION_TAG });
  const body = `${card.displayName} • Emergency code: ${card.code}\nFor authorised Sabi hospitals and your Care Circle.`;
  if (visible.some((n) => typeof n.body === 'string' && n.body !== body)) await showEmergencyNotification(card, 'granted');
}
export async function showEmergencyNotification(card, permissionResult) {
  if (!card.notificationEnabled) throw new Error('Turn on the Emergency Card notification first.');
  const support = notificationSupport();
  if (!support.available) throw new Error(support.installRequired ? 'On iPhone or iPad, add Sabi to your Home Screen and open it there to allow notifications.' : 'This browser cannot show Emergency Card notifications. You can still download your card.');
  // The caller may request permission directly inside the click handler before awaiting API work.
  const permission = permissionResult ?? (Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission);
  if (permission !== 'granted') throw new Error('Notifications are blocked in your phone or browser settings. Notification permission does not control emergency sharing.');
  const current = await registration();
  await current.showNotification('Sabi Emergency Card', {
    body: `${card.displayName} • Emergency code: ${card.code}\nFor authorised Sabi hospitals and your Care Circle.`,
    tag: EMERGENCY_NOTIFICATION_TAG, renotify: false, requireInteraction: true,
    icon: `${current.scope}pwa-192x192.png`, badge: `${current.scope}pwa-64x64.png`,
    data: { url: emergencyAccessUrl(card.code), kind: 'sabi-emergency-card' },
  });
}
