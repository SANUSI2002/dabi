// Phone and computer notifications for this device (Web Push). The service worker add-on
// (shared-portal/public/push-sw.js) shows them; this file asks permission and registers the device.
import { authorizedRequest } from "../utils/sabiIdentity";
import { devicePlatform, isInstalled } from "../../../shared-portal/pwa/installPrompt.js";

const data = async (promise) => (await promise).data;
const API = "/api/v1/notifications/push";

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** The browser's VAPID key format (base64url) as the bytes PushManager.subscribe expects. */
export function keyBytes(base64url) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function workerRegistration(timeoutMs = 6000) {
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Notifications need the installed app or the live site — they are not available in this preview.")), timeoutMs));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

/**
 * Where this device stands: "unsupported", "needs-install" (iPhone before installing), "unavailable"
 * (server not set up), "blocked" (permission denied), "on" or "off".
 */
export async function pushStatus() {
  if (!pushSupported()) return { state: devicePlatform() === "ios" && !isInstalled() ? "needs-install" : "unsupported" };
  const config = await data(authorizedRequest(`${API}/config`));
  if (!config.available) return { state: "unavailable", config };
  if (Notification.permission === "denied") return { state: "blocked", config };
  let subscription = null;
  try { subscription = await (await workerRegistration(1500)).pushManager.getSubscription(); } catch { /* no worker yet */ }
  const known = subscription && config.devices.some((device) => device.endpoint === subscription.endpoint);
  return { state: known ? "on" : "off", config, endpoint: subscription?.endpoint ?? null };
}

/** Asks permission (once), subscribes this device and registers it with Sabi. */
export async function enablePush() {
  const config = await data(authorizedRequest(`${API}/config`));
  if (!config.available) throw new Error("Phone notifications are not available yet.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw Object.assign(new Error("Notifications were not allowed. You can allow them in your browser or phone settings."), { code: "BLOCKED" });
  const registration = await workerRegistration();
  const subscription = await registration.pushManager.getSubscription()
    || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) });
  const { endpoint, keys } = subscription.toJSON();
  await authorizedRequest(`${API}/subscriptions`, { method: "POST", body: { endpoint, keys } });
  return pushStatus();
}

/** Stops notifications on this device (other devices keep theirs). */
export async function disablePush() {
  let subscription = null;
  try { subscription = await (await workerRegistration(1500)).pushManager.getSubscription(); } catch { /* nothing to remove */ }
  if (subscription) {
    await authorizedRequest(`${API}/subscriptions`, { method: "DELETE", body: { endpoint: subscription.endpoint } }).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
  }
  return pushStatus();
}

export const sendTestPush = () => data(authorizedRequest(`${API}/test`, { method: "POST", body: {} }));

/**
 * On an explicit Log out, this device stops showing the account's notifications (a shared phone should
 * not keep someone's reminders). Never delays signing out by more than a moment.
 */
export const forgetThisDevice = () => (pushSupported()
  ? Promise.race([disablePush().catch(() => {}), new Promise((resolve) => { setTimeout(resolve, 2500); })])
  : Promise.resolve());
