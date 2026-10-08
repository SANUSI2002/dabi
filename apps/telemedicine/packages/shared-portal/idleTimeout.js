// Signs a portal out after a period with no user input. This mirrors src/lib/idleTimeout.ts in the
// main Sabi app (a separately built app), and uses the same storage keys so the policy behaves the same.
//
// Activity is shared across tabs through localStorage, so an idle background tab never signs out the
// tab someone is working in (they share one server session). The deadline is checked against the wall
// clock on a timer and whenever the tab regains focus, so a device that slept past it signs out on waking.

/** Five minutes, matching the server's SESSION_IDLE_MINUTES default. */
export const IDLE_TIMEOUT_MS = 5 * 60_000;
/**
 * Dispatch on window to count as activity without input events, e.g. during a video call whose
 * clicks and keystrokes happen inside a cross-origin iframe the page cannot observe.
 */
export const ACTIVITY_EVENT = "sabi:activity";
/** Query flag sign-in pages read to explain an idle sign-out. */
export const IDLE_SIGN_OUT_REASON = "idle";

const ACTIVITY_KEY = "sabi:last-activity";
const SIGNED_OUT_KEY = "sabi:idle-sign-out";
const INPUT_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"];
const SHARE_INTERVAL_MS = 5_000;
const CHECK_INTERVAL_MS = 10_000;

function safeStorage(target) {
  try { return target.localStorage ?? null; } catch { return null; }
}

/**
 * Starts watching for inactivity and returns a stop function. `onIdle` runs at most once. While
 * `isSignedIn()` is false the clock is held, so it starts counting from the moment someone signs in.
 */
export function startIdleTimeout({ timeoutMs = IDLE_TIMEOUT_MS, onIdle, onActive, isSignedIn = () => true, now = () => Date.now(), target = globalThis.window, doc = globalThis.document, storage = safeStorage(target) }) {
  let last = now();
  let shared = 0;
  let fired = false;
  let stopped = false;
  let activitySent = 0;
  let sentAt = 0;
  let sending = false;

  const read = () => { try { return Number(storage?.getItem(ACTIVITY_KEY)) || 0; } catch { return 0; } };
  const write = (key, value) => { try { storage?.setItem(key, String(value)); } catch { /* private mode: this tab still times out on its own */ } };

  const fire = (broadcast) => {
    if (fired) return;
    fired = true;
    if (broadcast) write(SIGNED_OUT_KEY, now());
    onIdle();
  };
  const activity = () => {
    if (fired) return;
    last = now();
    if (last - shared >= SHARE_INTERVAL_MS) { shared = last; write(ACTIVITY_KEY, last); }
  };
  const check = () => {
    if (fired) return;
    if (!isSignedIn()) { last = now(); return; }
    const activeAt = Math.max(last, read());
    if (now() - activeAt >= timeoutMs) { fire(true); return; }
    // Only real input (or an active call) earns a heartbeat. Background timers must not
    // keep an unattended session alive. No clinical text is sent or stored here.
    if (onActive && !stopped && !sending && activeAt > activitySent && now() - activeAt < 60_000 && now() - sentAt >= 30_000) {
      activitySent = activeAt; sentAt = now(); sending = true;
      Promise.resolve().then(() => { if (!stopped && !fired && isSignedIn()) return onActive(); }).catch(() => {}).finally(() => { sending = false; });
    }
  };
  // Another tab hit the limit and is signing the shared session out: follow it.
  const onStorage = (event) => { if (event.key === SIGNED_OUT_KEY && event.newValue && isSignedIn()) fire(false); };
  const onVisible = () => { if (doc?.visibilityState === "visible") check(); };

  write(ACTIVITY_KEY, last);
  shared = last;
  INPUT_EVENTS.forEach((type) => target.addEventListener(type, activity, { passive: true, capture: true }));
  target.addEventListener(ACTIVITY_EVENT, activity);
  target.addEventListener("storage", onStorage);
  target.addEventListener("focus", check);
  doc?.addEventListener("visibilitychange", onVisible);
  const timer = setInterval(check, CHECK_INTERVAL_MS);

  return () => {
    stopped = true;
    INPUT_EVENTS.forEach((type) => target.removeEventListener(type, activity, { capture: true }));
    target.removeEventListener(ACTIVITY_EVENT, activity);
    target.removeEventListener("storage", onStorage);
    target.removeEventListener("focus", check);
    doc?.removeEventListener("visibilitychange", onVisible);
    clearInterval(timer);
  };
}

/** True when the current URL says the person was signed out for inactivity. */
export const signedOutForInactivity = (search) => new URLSearchParams(search).get("reason") === IDLE_SIGN_OUT_REASON;

/** Builds `<base>/login?reason=idle` for an app served under `baseUrl` (Vite's BASE_URL). */
export const idleSignInUrl = (baseUrl = "/") => `${baseUrl.replace(/\/$/, "")}/login?reason=${IDLE_SIGN_OUT_REASON}`;
