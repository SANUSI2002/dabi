import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { PREVIEW_ENABLED, signInDoctor, requestPasswordReset, verifySignIn } from "../../services/doctorAuth";
import { activateDoctorSession } from "../../store/doctorSession";
import { canonicalEmail } from "./registrationModel";
import { signedOutForInactivity } from "../../../../shared-portal/idleTimeout.js";

const IDLE_NOTICE = "For your security, you were signed out after 5 minutes of inactivity. Please sign in again.";

export default function SignInPage({ recovery = false }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [useRecovery, setUseRecovery] = useState(false);
  const [notice, setNotice] = useState(() => !recovery && signedOutForInactivity(window.location.search) ? IDLE_NOTICE : "");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setNotice(""); setBusy(true);
    try {
      if (recovery) {
        await requestPasswordReset(canonicalEmail(email));
        setNotice("If an account matches that address, you'll receive password reset instructions.");
        return;
      }
      const result = challenge ? await verifySignIn(challenge, code, useRecovery) : await signInDoctor(canonicalEmail(email), password);
      setPassword(""); setCode("");
      if (result.mfaRequired && result.challengeId) { setChallenge(result.challengeId); return; }
      if (result.doctor?.verificationStatus === "SUSPENDED" || result.doctor?.accountStatus !== "active") {
        setNotice("Your doctor account is not active. Please contact Sabi Health support."); return;
      }
      if (!result.doctor?.emailVerified || !result.doctor?.licenceVerified) {
        navigate("/registration/status", { state: { mode: "account", status: result.doctor?.emailVerified ? "review_pending" : "email_pending", email } }); return;
      }
      activateDoctorSession(result.doctor); navigate("/dashboard", { replace: true });
    } catch (error) {
      setPassword("");
      if (error.code === "EMAIL_VERIFICATION_REQUIRED") navigate("/registration/status", { state: { email, status: "email_pending" } });
      else setNotice(error.name === "TimeoutError" ? "This request took too long. Please try again." : error.message);
    }
    finally { setBusy(false); }
  }
  return <AuthLayout compact>
    <div className="sh-auth-topline"><span>PROFESSIONAL PORTAL</span><div>New to Sabi Health? <Link to="/register">Register</Link></div></div>
    <div className="sh-login-content">
      <span className="sh-auth-kicker">{recovery ? "ACCOUNT RECOVERY" : "WELCOME BACK"}</span>
      <h1>{recovery ? "Reset your password" : challenge ? "Verify your sign-in" : "Sign in to your workspace"}</h1>
      <p>{recovery ? "Enter your registered email to request password reset instructions." : challenge ? "Use your authenticator app or a saved recovery code." : "Use your Sabi ID to access your appointments and patient care."}</p>
      <form className="sh-register-form" onSubmit={submit}>
        {notice && <div className="sh-form-notice" role="status">{notice}</div>}
        {challenge ? <div className="sh-auth-field">
          <label htmlFor="code">{useRecovery ? "Recovery code" : "Authentication code"}</label>
          <input id="code" autoComplete="one-time-code" inputMode={useRecovery ? "text" : "numeric"} pattern={useRecovery ? undefined : "[0-9]{6}"} maxLength={useRecovery ? 64 : 6} required value={code} onChange={(e) => setCode(e.target.value)} />
          <button type="button" className="sh-inline-link" onClick={() => { setUseRecovery((v) => !v); setCode(""); setNotice(""); }}>{useRecovery ? "Use authenticator app" : "Use a recovery code"}</button>
        </div> : <>
          <div className="sh-auth-field"><label htmlFor="loginEmail">Email address</label><input id="loginEmail" type="email" autoComplete="username" maxLength={254} required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {!recovery && <div className="sh-auth-field">
            <label htmlFor="loginPassword">Password</label>
            <div className="sh-password-input"><input id="loginPassword" type={showPassword ? "text" : "password"} autoComplete="current-password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            <Link className="sh-forgot-link" to="/forgot-password">Forgot password?</Link>
          </div>}
        </>}
        <button className="sh-primary-button sh-full-button" disabled={busy}>{busy ? "Please wait…" : recovery ? "Send reset instructions" : challenge ? "Verify and sign in" : "Sign in"}<ArrowRight size={17} /></button>
        {challenge && <button type="button" className="sh-inline-link" onClick={() => { setChallenge(null); setCode(""); setNotice(""); }}>Back to sign in</button>}
      </form>
      {recovery && <Link className="sh-inline-link" to="/login">Back to sign in</Link>}
      {PREVIEW_ENABLED && <p className="sh-preview-disclosure">Local preview · <Link to="/preview">Explore the doctor workspace</Link></p>}
    </div>
  </AuthLayout>;
}
