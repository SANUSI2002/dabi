// Google / Apple in the professional portal. Only the account step changes: registration details,
// credential upload, screening and staff review are the same whichever way the account was created.
import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { activateDoctorSession } from "../../store/doctorSession";

const NAMES = { google: "Google", apple: "Apple", GOOGLE: "Google", APPLE: "Apple" };
export const providerName = (provider) => NAMES[provider] || "Google";

/** Where a signed-in professional goes next. Returns a notice instead when the account can't be used. */
export function routeSignedIn(navigate, result, email = "") {
  if (result.doctor?.verificationStatus === "SUSPENDED" || result.doctor?.accountStatus !== "active") return "Your doctor account is not active. Please contact Sabi Health support.";
  if (!result.doctor?.emailVerified || !result.doctor?.licenceVerified) {
    navigate("/registration/status", { state: { mode: "account", status: result.doctor?.emailVerified ? "review_pending" : "email_pending", email: email || result.doctor?.email } });
    return "";
  }
  activateDoctorSession(result.doctor);
  navigate("/dashboard", { replace: true });
  return "";
}

/** Google and Apple buttons. Hidden entirely until the server has a provider switched on. */
export function SocialButtons({ social, busy, onChoose, label = "or continue with" }) {
  const providers = ["google", "apple"].filter((p) => social.configured[p]);
  if (!providers.length) return null;
  return <div className="sh-social">
    <div className="sh-social-divider"><span>{label}</span></div>
    <div className="sh-social-row">{providers.map((provider) =>
      <button key={provider} type="button" className="sh-social-button" disabled={!social.available[provider] || !!busy} onClick={() => onChoose(provider)}>
        {provider === "google" ? <GoogleIcon /> : <AppleIcon />}<span>{busy === provider ? "Connecting…" : providerName(provider)}</span>
      </button>)}
    </div>
  </div>;
}

/**
 * Step 1 of registration. Choosing Google/Apple fills in name and email and replaces the password; an
 * account that already exists signs in instead. `linked` is the { signupToken, profile } hand-off.
 */
export function SocialAccountChoice({ social, linked, onLinked, onClear, onSignedIn, onNotice, disabled }) {
  const [busy, setBusy] = useState(null);
  async function choose(provider) {
    setBusy(provider); onNotice("");
    try {
      const result = await social.start(provider);
      if (result.signupRequired) onLinked(result);
      else onSignedIn(result);
    } catch (error) { if (!error.cancelled) onNotice(error.message); }
    finally { setBusy(null); }
  }
  if (linked) {
    const name = providerName(linked.profile?.provider);
    return <div className="sh-social-linked" role="status">
      <CheckCircle2 size={20} />
      <div>
        <strong>Signing up with {name}</strong>
        <p>{linked.profile?.email} · {name} has confirmed this email, so there's no password to create and no verification email to wait for. You'll upload your credentials straight after this form.</p>
        <button type="button" className="sh-inline-link" onClick={onClear}>Use email and password instead</button>
      </div>
    </div>;
  }
  if (disabled) return null;
  return <SocialButtons social={social} busy={busy} onChoose={choose} label="sign up faster with" />;
}

export function GoogleIcon() {
  return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.27-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
  </svg>;
}
export function AppleIcon() {
  return <svg width="16" height="18" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>;
}
