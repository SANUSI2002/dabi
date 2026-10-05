import React, { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { CheckCircle2, Circle, Mail, ShieldCheck } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { resendVerification, verifyEmail } from "../../services/doctorAuth";
import { PORTAL_BASE } from "../../services/runtime";

export default function RegistrationStatusPage({ verification = false }) {
  const location = useLocation();
  const [params] = useSearchParams();
  const [result, setResult] = useState(location.state || {});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const preview = result.mode === "preview";
  const reviewed = result.status === "review_pending";
  const token = params.get("token");
  async function action() {
    setBusy(true); setNotice("");
    try {
      if (verification && token) { await verifyEmail(token); setResult({ ...result, status: "review_pending", mode: "account" }); window.history.replaceState(null, "", `${PORTAL_BASE}verify-email`); }
      else { await resendVerification(result.email); setNotice("If an account matches that address, a new verification email will be sent."); }
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  }
  return <AuthLayout compact><div className="sh-login-content sh-status-content"><div className="sh-status-icon">{reviewed ? <ShieldCheck size={30} /> : preview ? <CheckCircle2 size={30} /> : <Mail size={30} />}</div><span className="sh-auth-kicker">{preview ? "REGISTRATION PREVIEW" : "ACCOUNT VERIFICATION"}</span><h1>{preview ? "Your application is ready" : reviewed ? "Your credentials are awaiting review" : verification ? "Verify your email address" : result.email ? "Check your email" : "Complete your registration"}</h1><p>{preview ? "You've completed the registration flow. No account has been created, no documents uploaded and no email sent in this preview." : reviewed ? "Email verification is complete. Clinical tools remain unavailable until your professional credentials are approved." : result.email ? `Use the verification link sent to ${result.email} to confirm your email address.` : "Register a doctor account or sign in to continue the verification process."}</p>{result.applicationId && <div className="sh-reference">Application reference <strong>{result.applicationId}</strong></div>}<div className="sh-status-timeline">{["Account details", "Email verification", "Credential review", "Workspace activation"].map((text, i) => <div key={text}>{!preview && (i === 0 && result.email || i === 1 && reviewed) ? <CheckCircle2 size={20} /> : <Circle size={20} />}<span>{text}</span><small>{preview ? i === 0 ? "Prepared" : "Next step" : i === 0 && result.email || i === 1 && reviewed ? "Complete" : "Pending"}</small></div>)}</div>{notice && <div className="sh-form-notice" role="status">{notice}</div>}{!preview && !reviewed && (result.email || token) && <button className="sh-primary-button" disabled={busy} onClick={action}>{busy ? "Please wait…" : verification && token ? "Verify email" : "Resend verification email"}</button>}<div className="sh-status-links"><Link to={preview || !result.email ? "/register" : "/login"}>{preview ? "Start a new application" : result.email ? "Back to sign in" : "Register as a doctor"}</Link>{preview && <Link to="/preview">Explore the portal preview</Link>}</div></div></AuthLayout>;
}
