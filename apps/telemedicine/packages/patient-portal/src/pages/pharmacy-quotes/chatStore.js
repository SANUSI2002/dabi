// A lightweight patient <-> pharmacy thread scoped to one prescription +
// one pharmacy. There's no pharmacy-facing portal yet (BACKEND REQUIRED),
// so a sent message has no reply until that side is connected — this
// never fabricates a pharmacy response.

const KEY = "sabi-pharmacy-chats";
const EVENT = "sabi-chat-updated";

function threadKey(prescriptionId, pharmacyId) {
  return `${prescriptionId}::${pharmacyId}`;
}

function getAll() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return {};
}

function persist(all) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
  return all;
}

export function subscribeToChat(listener) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

export function getThread(prescriptionId, pharmacyId) {
  return getAll()[threadKey(prescriptionId, pharmacyId)] || [];
}

export function sendMessage(prescriptionId, pharmacyId, pharmacyName, text) {
  const key = threadKey(prescriptionId, pharmacyId);
  const all = getAll();
  const thread = all[key] || [];
  const message = { id: `msg-${Date.now()}`, from: "patient", text, sentAt: new Date().toISOString() };
  const next = { ...all, [key]: [...thread, message] };
  persist(next);

  return next[key];
}
