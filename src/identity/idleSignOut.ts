import { surfaceForPath } from "@/deployment/surface";
import { useLiveEmr } from "@/emr-live/session";
import { hasLiveSession, liveSignOut } from "@/identity/liveIdentity";
import { useAuth } from "@/store/useAuth";

/** Query flag the sign-in pages read to explain why the person was signed out. */
export const IDLE_SIGN_OUT_REASON = "idle";

export const isSignedIn = () => useAuth.getState().authed || hasLiveSession();

/** Where to send someone who timed out on `pathname`; public pages stay where they are. */
export function idleSignInPath(pathname: string): string | null {
  if (pathname.startsWith('/pharmacy/courier')) return '/pharmacy/courier/login';
  const surface = surfaceForPath(pathname);
  if (surface === "health") return null;
  if (surface === "pharmacy") return "/pharmacy/login";
  if (surface === "command-center") return "/command-center/login";
  return "/login";
}

/** Ends every session this tab holds after the idle limit: the live one (revoked on the server) and the demo one. */
export async function signOutForInactivity() {
  // The live EMR store also forgets its organization; other live screens hold only the identity token.
  if (useLiveEmr.getState().access) await useLiveEmr.getState().signOut();
  else if (hasLiveSession()) await liveSignOut();
  if (useAuth.getState().authed) useAuth.getState().signOut();
  const target = idleSignInPath(window.location.pathname);
  // A full navigation drops every in-memory trace of the session, not just the stores above.
  if (target) window.location.assign(`${target}?reason=${IDLE_SIGN_OUT_REASON}`);
}

export const signedOutForInactivity = (search: string) => new URLSearchParams(search).get("reason") === IDLE_SIGN_OUT_REASON;
