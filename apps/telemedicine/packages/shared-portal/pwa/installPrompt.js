// "Install the app" support for the portals.
//
// Chrome, Edge and Samsung Internet fire `beforeinstallprompt` once the app is installable; it is kept
// here (captureInstallPrompt() runs before React mounts, so the event is never missed) and replayed
// when the person taps Install. iPhone and iPad have no such event: they install from Safari's Share
// menu, so the UI shows those two steps instead. Nothing is shown once the app runs installed.
import { useSyncExternalStore } from "react";

const DISMISSED_KEY = "sabi-install-dismissed-at";
const DAY = 86_400_000;

let deferredPrompt = null;
let justInstalled = false;
let snapshot = null;
const listeners = new Set();

const emit = () => { snapshot = null; listeners.forEach((listener) => listener()); };

export function captureInstallPrompt() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // Sabi shows its own invitation instead of the browser's mini bar
    deferredPrompt = event;
    emit();
  });
  window.addEventListener("appinstalled", () => { deferredPrompt = null; justInstalled = true; emit(); });
}

export const isInstalled = () => justInstalled
  || Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches)
  || window.navigator.standalone === true;

export function devicePlatform() {
  const ua = window.navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/** { installed, canPrompt, platform } — canPrompt means the browser's own install dialog is ready. */
export function installState() {
  if (!snapshot) snapshot = { installed: isInstalled(), canPrompt: Boolean(deferredPrompt), platform: devicePlatform() };
  return snapshot;
}

export function subscribeInstall(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useInstallState = () => useSyncExternalStore(subscribeInstall, installState, installState);

/** Opens the browser's install dialog. Resolves "accepted", "dismissed" or "unavailable". */
export async function promptInstall() {
  const event = deferredPrompt;
  if (!event) return "unavailable";
  deferredPrompt = null; // a prompt can be shown only once; the browser sends a fresh one later
  emit();
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") { justInstalled = true; emit(); }
  return outcome;
}

export function dismissedRecently(days = 7) {
  try { const at = Number(window.localStorage.getItem(DISMISSED_KEY)); return Boolean(at) && Date.now() - at < days * DAY; } catch { return false; }
}
export function rememberDismissal() {
  try { window.localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* private mode: ask again next time */ }
}
