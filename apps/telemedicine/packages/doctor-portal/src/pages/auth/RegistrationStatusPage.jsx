import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Mail, ShieldCheck } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { AUTH_CONFIGURED, doctorOnboardingRequest, resendVerification, verifyEmail } from "../../services/doctorAuth";
import { documentError } from "./registrationModel";

const kinds = [["licence", "Practising licence"], ["registrationCertificate", "MDCN registration certificate"]];
export default function RegistrationStatusPage({ verification = false }) {
  const location = useLocation();
  const { uid } = useParams();
  const result = location.state || {};
  const [token] = useState(() => verification ? location.hash.slice(1) : "");
  const [email, setEmail] = useState(result.email || "");
  const [verified, setVerified] = useState(false);
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [sessionNotice, setSessionNotice] = useState("");
  const [files, setFiles] = useState({});
  const preview = result.mode === "preview";
  useEffect(() => {
    if (verification && location.hash) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }, [verification, location.hash]);
  async function refresh() {
    setLoading(true); setSessionNotice("");
    try { setApplication((await doctorOnboardingRequest("/doctors/me")).data); }
    catch (error) { setSessionNotice(error.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (AUTH_CONFIGURED && !preview && !verification) refresh(); }, [preview, verification]);
  async function action(name, work) {
    if (busy) return;
    setBusy(name); setNotice("");
    try { await work(); }
    catch (error) { setNotice(error.name === "TimeoutError" ? "This request took too long. Try again; your account has not been duplicated." : error.message); }
    finally { setBusy(""); }
  }
  async function upload(kind) {
    const file = files[kind];
    const error = documentError(file, application.maxUploadBytes);
    if (error) throw new Error(error);
    await doctorOnboardingRequest(`/doctors/applications/${application.applicationId}/credentials/${kind}`, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    setFiles((current) => ({ ...current, [kind]: null }));
    await refresh();
    setNotice("Document uploaded privately. Malware screening runs in the background. Submit both documents for staff review.");
  }
  return <AuthLayout compact><div className="sh-login-content sh-status-content">
    <div className="sh-status-icon">{application ? <ShieldCheck size={30} /> : <Mail size={30} />}</div>
    <span className="sh-auth-kicker">{preview ? "REGISTRATION PREVIEW" : "DOCTOR APPLICATION"}</span>
    <h1>{preview ? "Your application is ready" : application?.status === "VERIFIED" ? "Your credentials are approved" : application ? "Complete your credential application" : verified ? "Email verified" : verification ? "Verify your email" : "Verify email, then upload credentials"}</h1>
    <p>{preview ? "No account has been created, no documents uploaded and no email sent in this local preview." : verified ? "Your email is verified. Sign in with the password you chose to upload your credentials." : application?.status === "VERIFIED" ? "Sabi operations has approved your credentials. Sign in again to open your clinical workspace." : "Registration → email verification → private credential upload → malware screening → staff authenticity review → workspace approval."}</p>
    {!preview && !application && <>
      {verification && !verified && token && uid && <button className="sh-primary-button" disabled={!!busy} onClick={() => action("verify", async () => { await verifyEmail(uid, token); setVerified(true); })}>{busy === "verify" ? "Verifying…" : "Verify email"}</button>}
      {verification && !token && !verified && <p className="sh-form-notice">Open the full link in your verification email. If it has expired or was already used, request a new email below or try signing in.</p>}
      {result.emailSent === false && <p className="sh-form-notice">Your account was created, but the email could not be delivered. Request another verification email below.</p>}
      {!verified && <form className="sh-register-form" onSubmit={(event) => { event.preventDefault(); action("resend", async () => { await resendVerification(email.trim()); setNotice("If an eligible unverified account matches that address, verification instructions have been requested."); }); }}>
        <div className="sh-auth-field"><label htmlFor="verificationEmail">Registered email address</label><input id="verificationEmail" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <button className="sh-secondary-button" disabled={!!busy}>{busy === "resend" ? "Requesting…" : "Resend verification email"}</button>
      </form>}
    </>}
    {loading && <p role="status">Loading your application…</p>}
    {sessionNotice && <p className="sh-form-notice" role="status">{sessionNotice}</p>}
    {application && <>
      <div className="sh-reference">Application reference <strong>{application.applicationId || "Legacy profile — contact operations"}</strong></div>
      <p><strong>{application.status}</strong> · {application.email}</p>
      {application.decisionReason && <p className="sh-form-notice">Staff review: {application.decisionReason}</p>}
      {application.applicationId && ["PENDING", "REJECTED"].includes(application.status) && <>
        <p>PDF, PNG or JPEG · up to {(application.maxUploadBytes / 1000000).toFixed(1)} MB each. Upload clear copies; no patient records. Replacing a document resets submission and that document’s review.</p>
        {kinds.map(([kind, label]) => {
          const document = application.credentials.find((item) => item.kind === kind);
          return <section className="sh-review-section" key={kind}><h3>{label}</h3>
            <p>{document ? `Screening: ${document.scanStatus} · Authenticity: ${document.reviewStatus}` : "Not uploaded"}</p>
            {document?.scanErrorCode && <p className="sh-form-notice">Screening needs attention ({document.scanErrorCode}). Contact operations for a retry, or replace an unsafe file.</p>}
            {document?.reviewStatus === "REJECTED" && <p className="sh-form-notice">{document.note || "Replace this document with corrected evidence."}</p>}
            <div className="sh-auth-field"><label htmlFor={kind}>{document ? "Replace document" : "Choose document"}</label><input id={kind} type="file" accept="application/pdf,image/png,image/jpeg" disabled={!!busy} onChange={(event) => { setFiles((current) => ({ ...current, [kind]: event.target.files?.[0] || null })); event.target.value = ""; }} /></div>
            {files[kind] && <p>{files[kind].name} · {(files[kind].size / 1024).toFixed(0)} KB</p>}
            <button className="sh-secondary-button" disabled={!!busy || !files[kind]} onClick={() => action(kind, () => upload(kind))}>{busy === kind ? "Uploading…" : document ? "Upload replacement" : "Upload privately"}</button>
          </section>;
        })}
        <button className="sh-primary-button" disabled={!!busy || !!application.submittedAt || application.credentials.length !== 2} onClick={() => action("submit", async () => { await doctorOnboardingRequest(`/doctors/applications/${application.applicationId}/submit`, { method: "POST", body: "{}" }); await refresh(); setNotice("Submitted to Sabi operations. Screening and independent authenticity review must complete before approval."); })}>{busy === "submit" ? "Submitting…" : application.submittedAt ? "Submitted for review" : "Submit credentials for review"}</button>
        <div className="sh-status-timeline">{application.blockers.map((blocker) => <p key={blocker}>{blocker}</p>)}</div>
      </>}
      <button className="sh-inline-link" disabled={loading || !!busy} onClick={refresh}>Refresh application status</button>
    </>}
    {notice && <div className="sh-form-notice" role="status">{notice}</div>}
    <div className="sh-status-links"><Link to={preview ? "/register" : "/login"}>{preview ? "Start a new application" : "Sign in"}</Link><Link to="/register">Doctor registration</Link>{preview && <Link to="/preview">Explore local preview</Link>}</div>
  </div></AuthLayout>;
}
