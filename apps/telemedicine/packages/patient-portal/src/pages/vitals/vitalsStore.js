import { SEED_READINGS } from "./data";

const KEY_PREFIX = "sabi-vitals:";

// Minimal localStorage-backed store so a reading added on "Add Vital
// Reading" actually shows up on the History page afterwards, without
// needing a backend or a shared React state tree between routes.
export function getReadings(typeId) {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + typeId);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to seed */
  }
  return SEED_READINGS[typeId] || [];
}

export function addReading(typeId, reading) {
  const current = getReadings(typeId);
  const next = [{ id: `${typeId}-${Date.now()}`, ...reading }, ...current];
  try {
    window.localStorage.setItem(KEY_PREFIX + typeId, JSON.stringify(next));
  } catch {
    /* ignore write failures (e.g. private browsing) */
  }
  return next;
}

export function removeReading(typeId, readingId) {
  const next = getReadings(typeId).filter((r) => r.id !== readingId);
  try {
    window.localStorage.setItem(KEY_PREFIX + typeId, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
