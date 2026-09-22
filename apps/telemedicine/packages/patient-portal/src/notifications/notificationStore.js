// Shared patient notification center (localStorage, subscribe pattern —
// same shape as cartStore.js / appointmentStore.js). Powers the bell icon
// in Topbar and covers every "Patient Notifications" line from the
// pharmacy/prescription PRD: prescription received by pharmacies, a
// pharmacy sending a quotation, invoice updates, successful payment, and
// the three order-progress stages.

const KEY = "sabi-notifications";
const EVENT = "sabi-notifications-updated";

export function getNotifications() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return [];
}

function persist(list) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
  return list;
}

export function subscribeToNotifications(listener) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

export function getUnreadCount() {
  return getNotifications().filter((n) => !n.read).length;
}

// dedupeKey lets a caller avoid pushing the same lifecycle event twice
// (e.g. "quotes received" firing once per prescription, not once per
// quotes-page render).
export function pushNotification({ title, body, kind = "info", dedupeKey } = {}) {
  const list = getNotifications();
  if (dedupeKey && list.some((n) => n.dedupeKey === dedupeKey)) return list;

  const entry = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    body,
    kind, // info | success | warning
    read: false,
    createdAt: new Date().toISOString(),
    dedupeKey,
  };
  return persist([entry, ...list].slice(0, 50));
}

export function markRead(id) {
  return persist(getNotifications().map((n) => (n.id === id ? { ...n, read: true } : n)));
}

export function markAllRead() {
  return persist(getNotifications().map((n) => ({ ...n, read: true })));
}
