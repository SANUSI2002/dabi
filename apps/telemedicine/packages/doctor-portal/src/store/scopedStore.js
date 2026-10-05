import { getDoctorId, PRIMARY_DOCTOR_ID } from "./doctorSession.js";
export function doctorStorageKey(key) { return key + ":" + getDoctorId(); }
export function readDoctorStorage(key) {
  if (getDoctorId() === "signed-out") return null;
  const scoped = window.localStorage.getItem(doctorStorageKey(key));
  if (scoped !== null) return scoped;
  // Keep existing prototype data attached to the original demo doctor only.
  return getDoctorId() === PRIMARY_DOCTOR_ID ? window.localStorage.getItem(key) : null;
}
export function writeDoctorStorage(key, value) {
  if (getDoctorId() === "signed-out") throw new Error("Select a doctor before saving");
  try { window.localStorage.setItem(doctorStorageKey(key), value); } catch (error) {
    if (typeof window.dispatchEvent === "function") window.dispatchEvent(new Event("sabi-save-failed"));
    throw error;
  }
}
export function createScopedStore({ key, seed = [], validate = Array.isArray, normalize = (value) => value, scope = getDoctorId, shared = false }) {
  const caches = new Map();
  const listeners = new Set();
  const storageKey = () => shared ? key + ":" + scope() : doctorStorageKey(key);
  function get() {
    const id = scope();
    if (caches.has(id)) return caches.get(id);
    let value;
    try {
      const raw = shared ? window.localStorage.getItem(storageKey()) : readDoctorStorage(key);
      const parsed = raw === null ? null : JSON.parse(raw);
      if (validate(parsed)) value = normalize(parsed);
    } catch { /* malformed or unavailable storage: use a safe scoped default */ }
    if (value === undefined) value = normalize(structuredClone(typeof seed === "function" ? seed() : seed));
    caches.set(id, value);
    return value;
  }
  function write(value) {
    if (getDoctorId() === "signed-out") throw new Error("Select a doctor before saving");
    const clean = normalize(value);
    if (!validate(clean)) throw new Error("Invalid data for " + key);
    // Do not show a successful save when persistence fails.
    try { window.localStorage.setItem(storageKey(), JSON.stringify(clean)); } catch (error) {
      if (typeof window.dispatchEvent === "function") window.dispatchEvent(new Event("sabi-save-failed"));
      throw error;
    }
    caches.set(scope(), clean);
    return clean;
  }
  function notify() { listeners.forEach((fn) => fn()); }
  function invalidate() { caches.delete(scope()); }
  if (typeof window.addEventListener === "function") window.addEventListener("storage", (event) => {
    if (event.key === storageKey() || event.key === null) { invalidate(); notify(); }
  });
  return { get, write, notify, invalidate, subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); } };
}
