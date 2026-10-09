// One device at a time: when the account signs in on another device, the server ends this device's
// session. This watch notices within seconds — a light check every 10 seconds while the app is on
// screen, and at once when it comes back to the foreground or online — then signs this device out
// and says why. Any request refused with SIGNED_IN_ELSEWHERE triggers it immediately too.
// The check does not count as activity on the server, so it never keeps an idle session alive.

export const SIGNED_IN_ELSEWHERE = "SIGNED_IN_ELSEWHERE";
export const ELSEWHERE_REASON = "elsewhere";
export const ELSEWHERE_NOTICE = "You were signed out because your account was signed in on another device. If that wasn't you, sign in and change your password.";
export const CHECK_EVERY_MS = 10_000;

const EVENT = "sabi:signed-in-elsewhere";
const SHARED_KEY = "sabi:signed-in-elsewhere";

function safeStorage(target) {
  try { return target?.localStorage ?? null; } catch { return null; }
}

/** Call when any request is refused with SIGNED_IN_ELSEWHERE. */
export function reportSignedInElsewhere(target = globalThis.window) {
  target?.dispatchEvent(new Event(EVENT));
}

/**
 * Starts watching and returns a stop function. `check()` resolves "active", "elsewhere" or "unknown"
 * (offline, busy, token expired: try again later). `onSignedInElsewhere` runs at most once, and every
 * open tab of this app follows the first one that notices.
 */
export function startSessionWatch({ check, onSignedInElsewhere, isSignedIn = () => true, intervalMs = CHECK_EVERY_MS, target = globalThis.window, doc = globalThis.document, storage = safeStorage(target) }) {
  let fired = false;
  let busy = false;
  let stopped = false;

  const fire = (broadcast) => {
    if (fired || stopped) return;
    fired = true;
    if (broadcast) { try { storage?.setItem(SHARED_KEY, String(Date.now())); } catch { /* other tabs find out on their own check */ } }
    onSignedInElsewhere();
  };
  const run = async () => {
    if (fired || busy || stopped || !isSignedIn() || doc?.visibilityState === "hidden") return;
    busy = true;
    try { if (await check() === "elsewhere") fire(true); } catch { /* offline or busy: the next check tries again */ } finally { busy = false; }
  };
  const onReported = () => { if (isSignedIn()) fire(true); };
  const onStorage = (event) => { if (event.key === SHARED_KEY && event.newValue && isSignedIn()) fire(false); };
  const onVisible = () => { if (doc?.visibilityState === "visible") void run(); };
  const onWake = () => { void run(); };

  target.addEventListener(EVENT, onReported);
  target.addEventListener("storage", onStorage);
  target.addEventListener("focus", onWake);
  target.addEventListener("online", onWake);
  doc?.addEventListener("visibilitychange", onVisible);
  const timer = setInterval(run, intervalMs);

  return () => {
    stopped = true;
    target.removeEventListener(EVENT, onReported);
    target.removeEventListener("storage", onStorage);
    target.removeEventListener("focus", onWake);
    target.removeEventListener("online", onWake);
    doc?.removeEventListener("visibilitychange", onVisible);
    clearInterval(timer);
  };
}

/** True when the sign-in page was opened because this device was signed out by a sign-in elsewhere. */
export const signedOutElsewhere = (search) => new URLSearchParams(search).get("reason") === ELSEWHERE_REASON;

/** `<base>/login?reason=elsewhere` for an app served under `baseUrl` (Vite's BASE_URL). */
export const elsewhereSignInUrl = (baseUrl = "/") => `${baseUrl.replace(/\/$/, "")}/login?reason=${ELSEWHERE_REASON}`;
