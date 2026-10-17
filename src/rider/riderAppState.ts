// Riders and pharmacies share a deployment, but must install as distinct apps.
// The existing root worker serves code only; no delivery, location or financial data is cached.
export const isRiderPath = (path: string) => /^\/rider(?:\/|$)/.test(path);
let previousManifest: string | null | undefined;
let previousAppleTitle: string | null;
let previousTheme: string | null;

export function setRiderManifest(path: string) {
  const rider = isRiderPath(path);
  let manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (rider && previousManifest === undefined) {
    previousManifest = manifest?.getAttribute('href') ?? null;
    previousAppleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content') ?? null;
    previousTheme = document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
    if (!manifest) { manifest = document.createElement('link'); manifest.rel = 'manifest'; document.head.append(manifest); }
    manifest.setAttribute('href', '/rider/manifest.webmanifest');
    setMeta('apple-mobile-web-app-title', 'Sabi Rider');
    setMeta('theme-color', '#0b7a5c');
  } else if (!rider && previousManifest !== undefined) {
    if (previousManifest === null) manifest?.remove();
    else manifest?.setAttribute('href', previousManifest);
    restoreMeta('apple-mobile-web-app-title', previousAppleTitle);
    restoreMeta('theme-color', previousTheme);
    previousManifest = undefined;
    prompt = null;
  }
}
function setMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) { meta = document.createElement('meta'); meta.name = name; document.head.append(meta); }
  meta.content = content;
}
function restoreMeta(name: string, value: string | null) {
  if (value === null) document.querySelector(`meta[name="${name}"]`)?.remove();
  else setMeta(name, value);
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let prompt: InstallEvent | null = null;
let installed = false;
let initialized = false;
let revision = 0;
const listeners = new Set<() => void>();
const notify = () => { revision++; listeners.forEach((fn) => fn()); };
export const subscribeRiderPwa = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const riderPwaSnapshot = () => revision;
export function riderPwaState() {
  return {
    online: navigator.onLine,
    installed: installed || Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches) || Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    canInstall: Boolean(prompt),
    ios: /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  };
}
export function initializeRiderPwa() {
  setRiderManifest(window.location.pathname);
  if (initialized) return;
  initialized = true;
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  window.addEventListener('beforeinstallprompt', (event) => {
    if (!isRiderPath(window.location.pathname)) return;
    event.preventDefault(); prompt = event as InstallEvent; notify();
  });
  window.addEventListener('appinstalled', () => {
    if (isRiderPath(window.location.pathname)) { prompt = null; installed = true; notify(); }
  });
}
export async function installRiderApp() {
  const event = prompt;
  if (!event) return 'unavailable';
  prompt = null; notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === 'accepted') { installed = true; notify(); }
  return outcome;
}
