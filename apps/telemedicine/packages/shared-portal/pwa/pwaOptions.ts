// Installable-app (PWA) settings shared by every Sabi web app: the main app (health, EMR, pharmacy
// and command-center deployments), the patient portal and the professional portal.
//
// What is cached, and why:
// - Up front: the app shell and its code (HTML, JS, CSS, fonts, icons). Keep the HTML and
//   content-hashed JavaScript together: an older installed shell must not depend on code
//   that the next deployment has already removed from the server.
// - On first use: this app's own images (immutable, content-hashed), cache-first.
// - Never: /api (patient and clinical data), other origins (video, payments, maps), or another
//   Sabi app hosted under this one (e.g. /doctor-portal/ under the patient portal).
// Updates wait for the person to choose "Reload" (see registerPwa.ts), so a form being filled in
// is never lost to an automatic refresh.
//
// The return value is passed straight to VitePWA(). It is typed by inference (with exact literals)
// rather than against VitePWAOptions because the main app and the portals install separate copies
// of vite-plugin-pwa, whose types TypeScript would treat as different.
export type SabiPwaApp = {
  /** Short id for this app's runtime caches. Cache storage is shared per domain, and the patient
   *  and professional portals share one, so each app needs its own cache names. */
  cacheId: string;
  name: string;
  shortName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  /** Paths of other Sabi apps nested inside this one; their pages are never served from this app. */
  nestedApps: RegExp[];
  /** Extra worker scripts from the public folder, e.g. push-sw.js for phone notifications. */
  importScripts?: string[];
};

const MONTH = 60 * 60 * 24 * 30;

// Workbox copies these functions into the generated service worker as source text, so they must
// not close over anything. In the worker, globalThis is the worker's own scope and
// registration.scope is this app's URL prefix, so each app caches only its own files even when
// several apps share a domain.
type Match = { url: URL; sameOrigin: boolean };
const ownCode = ({ url, sameOrigin }: Match) =>
  sameOrigin && url.href.startsWith(`${(globalThis as unknown as { registration: { scope: string } }).registration.scope}assets/`) && /\.(?:js|css)$/.test(url.pathname);
const ownImages = ({ url, sameOrigin }: Match) =>
  sameOrigin && url.href.startsWith(`${(globalThis as unknown as { registration: { scope: string } }).registration.scope}assets/`) && /\.(?:png|jpe?g|webp|avif|gif|svg)$/.test(url.pathname);

export function sabiPwaOptions(app: SabiPwaApp) {
  return {
    registerType: "prompt" as const,
    injectRegister: false as const, // registered by registerPwa() so updates can ask first
    manifest: {
      name: app.name,
      short_name: app.shortName,
      description: app.description,
      lang: "en",
      dir: "ltr" as const,
      display: "standalone" as const,
      theme_color: app.themeColor,
      background_color: app.backgroundColor,
      // start_url and scope default to the build's base path (/, /telemedicine/, /doctor-portal/…).
      icons: [
        { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
        { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
        { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    workbox: {
      // Top-level files only: a nested app built into a subfolder is never precached here.
      // (Manifest icons are added by the plugin itself.)
      globPatterns: ["*.html", "assets/*.{js,css,woff2}", "*.svg", "apple-touch-icon-*.png"],
      navigateFallbackDenylist: [/^\/api(?:\/|$)/, ...app.nestedApps],
      runtimeCaching: [
        { urlPattern: ownCode, handler: "CacheFirst" as const, options: { cacheName: `sabi-${app.cacheId}-code`, expiration: { maxEntries: 600, maxAgeSeconds: MONTH } } },
        { urlPattern: ownImages, handler: "CacheFirst" as const, options: { cacheName: `sabi-${app.cacheId}-images`, expiration: { maxEntries: 80, maxAgeSeconds: MONTH } } },
      ],
      cleanupOutdatedCaches: true,
      ...(app.importScripts?.length ? { importScripts: app.importScripts } : {}),
    },
  };
}
