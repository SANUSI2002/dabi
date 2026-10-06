import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { startIdleTimeout } from "@/lib/idleTimeout";
import { isSignedIn, signedOutForInactivity, signOutForInactivity } from "@/identity/idleSignOut";

/** Mounted once at the app root: signs out after five minutes without input, in every signed-in area. */
export function IdleSessionGuard() {
  useEffect(() => startIdleTimeout({ isSignedIn, onIdle: () => { void signOutForInactivity(); } }), []);
  return null;
}

/** Shown on sign-in pages after an idle sign-out. */
export function IdleSignOutNotice({ className = "" }: { className?: string }) {
  const { search } = useLocation();
  if (!signedOutForInactivity(search)) return null;
  return <p role="status" className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ${className}`}>For your security, you were signed out after 5 minutes of inactivity. Please sign in again.</p>;
}
