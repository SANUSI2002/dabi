/// <reference types="vite-plugin-pwa/client" />
// Registers the app's service worker (built from pwaOptions.ts). When a new version is deployed it
// never reloads by itself: someone may be halfway through a clinical note or a booking. A small
// notice offers "Reload" instead. Installed apps can stay open for days, so updates are also
// checked hourly.
import { registerSW } from "virtual:pwa-register";

const NOTICE_ID = "sabi-pwa-update";
const HOUR = 60 * 60 * 1000;

function showUpdateNotice(reload: () => Promise<void>) {
  if (document.getElementById(NOTICE_ID)) return;
  const notice = document.createElement("div");
  notice.id = NOTICE_ID;
  notice.setAttribute("role", "status");
  notice.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;max-width:calc(100vw - 32px);padding:10px 12px 10px 16px;border-radius:12px;background:#0a2e22;color:#fff;box-shadow:0 10px 30px rgba(6,29,21,.3);font:500 14px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif";
  const text = document.createElement("span");
  text.textContent = "A new version of Sabi is ready. Save any unsaved work, then reload.";
  const button = (label: string, primary: boolean) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText = `min-height:40px;padding:0 14px;border-radius:8px;border:0;cursor:pointer;font:700 14px/1 inherit;${primary ? "background:#2fdd8a;color:#062016" : "background:transparent;color:#d6efe2"}`;
    return b;
  };
  const reloadButton = button("Reload", true);
  const laterButton = button("Later", false);
  reloadButton.addEventListener("click", () => { reloadButton.disabled = true; reloadButton.textContent = "Reloading…"; void reload(); });
  laterButton.addEventListener("click", () => notice.remove());
  notice.append(text, reloadButton, laterButton);
  document.body.append(notice);
}

export function registerPwa() {
  if (!("serviceWorker" in navigator)) return;
  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh: () => showUpdateNotice(() => updateServiceWorker(true)),
    onRegisteredSW: (_url, registration) => {
      if (registration) setInterval(() => { if (navigator.onLine) void registration.update(); }, HOUR);
    },
  });
}
