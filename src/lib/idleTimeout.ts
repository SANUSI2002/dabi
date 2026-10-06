// Signs a browser out after a period with no user input. Activity is shared across tabs through
// localStorage, so an idle background tab never signs out the tab someone is working in (both use the
// same server session). The deadline is checked against the wall clock on a timer and whenever the tab
// regains focus, so a laptop that slept through the deadline signs out the moment it wakes.

/** Five minutes, matching the server's SESSION_IDLE_MINUTES default. */
export const IDLE_TIMEOUT_MS = 5 * 60_000;
/**
 * Dispatch on window to count as activity without input events, e.g. while in a video call whose
 * clicks and keystrokes happen inside a cross-origin iframe the page cannot observe.
 */
export const ACTIVITY_EVENT = "sabi:activity";

const ACTIVITY_KEY = "sabi:last-activity";
const SIGNED_OUT_KEY = "sabi:idle-sign-out";
const INPUT_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;
const SHARE_INTERVAL_MS = 5_000;
const CHECK_INTERVAL_MS = 10_000;

type Options = {
  timeoutMs?: number;
  onIdle: () => void;
  /** While this returns false (nobody signed in) the clock is held at zero instead of running out. */
  isSignedIn?: () => boolean;
  now?: () => number;
  storage?: Storage | null;
};

function safeStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/** Starts watching for inactivity; returns a function that stops watching. `onIdle` runs at most once. */
export function startIdleTimeout({ timeoutMs = IDLE_TIMEOUT_MS, onIdle, isSignedIn = () => true, now = () => Date.now(), storage = safeStorage() }: Options): () => void {
  let last = now();
  let shared = 0;
  let fired = false;

  const read = () => { try { return Number(storage?.getItem(ACTIVITY_KEY)) || 0; } catch { return 0; } };
  const write = (key: string, value: number) => { try { storage?.setItem(key, String(value)); } catch { /* private mode: this tab still times out on its own */ } };

  const fire = (broadcast: boolean) => {
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
    if (now() - Math.max(last, read()) >= timeoutMs) fire(true);
  };
  const onStorage = (event: StorageEvent) => {
    // Another tab hit the limit and is signing the shared session out: follow it.
    if (event.key === SIGNED_OUT_KEY && event.newValue && isSignedIn()) fire(false);
  };
  const onVisible = () => { if (document.visibilityState === "visible") check(); };

  write(ACTIVITY_KEY, last);
  shared = last;
  INPUT_EVENTS.forEach((type) => window.addEventListener(type, activity, { passive: true, capture: true }));
  window.addEventListener(ACTIVITY_EVENT, activity);
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", onVisible);
  const timer = window.setInterval(check, CHECK_INTERVAL_MS);

  return () => {
    INPUT_EVENTS.forEach((type) => window.removeEventListener(type, activity, { capture: true }));
    window.removeEventListener(ACTIVITY_EVENT, activity);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", check);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(timer);
  };
}
