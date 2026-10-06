import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Mail, ShieldCheck } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { AUTH_CONFIGURED, doctorOnboardingRequest, resendVerification, verifyEmail } from "../../services/doctorAuth";
import { documentError } from "./registrationModel";
import CredentialUpload from "./CredentialUpload";
import ApplicationDetailsEditor from './ApplicationDetailsEditor';

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
  const [uploadErrors, setUploadErrors] = useState({});
  const working = useRef(false);
  const refreshing = useRef(null);
  const revision = useRef(0);
  const preview = result.mode === "preview";
  const required = application?.requiredCredentials?.map(({kind,label}) => [kind,label]) || kinds;
  useEffect(() => {
    if (verification && location.hash) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }, [verification, location.hash]);
  async function refresh(silent = false) {
    if (refreshing.current) { if (silent) return; await refreshing.current; }
    const version = revision.current;
    const pending = (async () => {
      if (!silent) setLoading(true);
      setSessionNotice("");
      try { const result = await doctorOnboardingRequest("/doctors/me"); if (version === revision.current) setApplication(result.data); }
      catch (error) { setSessionNotice(error.message); }
      finally { if (!silent) setLoading(false); }
    })();
    refreshing.current = pending;
    await pending;
    if (refreshing.current === pending) refreshing.current = null;
  }
  useEffect(() => { if (AUTH_CONFIGURED && !preview && !verification) refresh(); }, [preview, verification]);
  useEffect(() => {
    if (!application || application.status !== "PENDING" || !application.credentials.length) return;
    const timer = setInterval(() => { if (!working.current && document.visibilityState === "visible") refresh(true); }, 10000);
    return () => clearInterval(timer);
  }, [application?.applicationId, application?.status, application?.credentials.length]);
  async function action(name, work) {
    if (working.current) return;
    working.current = true;
    setBusy(name); setNotice("");
    try { await work(); }
    catch (error) { setNotice(error.name === "TimeoutError" ? "This request took too long. Try again; your account has not been duplicated." : error.message); }
    finally { working.current = false; setBusy(""); }
  }
  async function upload(kind, file) {
    const error = documentError(file, application.maxUploadBytes);
    if (error) throw new Error(error);
    setUploadErrors((current) => ({ ...current, [kind]: "" }));
    try {
      const response = await doctorOnboardingRequest(`/doctors/applications/${application.applicationId}/credentials/${kind}`, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      revision.current += 1;
      // Invalidate old submission immediately, even if the status refresh fails.
      setApplication((current) => ({ ...current, submittedAt: null, credentials: [...current.credentials.filter((doc) => doc.kind !== kind), response.data] }));
      await refresh();
      setNotice("Document uploaded successfully. Security checks are running in the background.");
    } catch (cause) {
      setUploadErrors((current) => ({ ...current, [kind]: cause.name === "TimeoutError" ? "Upload timed out. Refresh your status to check whether it was received before retrying." : cause.message }));
      throw cause;
    }
  }
  function selectFile(kind, file) {
    setFiles((current) => ({ ...current, [kind]: file }));
    setNotice(""); setUploadErrors((current) => ({ ...current, [kind]: "" }));
    if (!documentError(file, application.maxUploadBytes)) action(kind, () => upload(kind, file));
  }
  return <AuthLayout compact><div className="sh-login-content sh-status-content">
    <div className="sh-status-icon">{application ? <ShieldCheck size={30} /> : <Mail size={30} />}</div>
    <span className="sh-auth-kicker">{preview ? "REGISTRATION PREVIEW" : "PROFESSIONAL APPLICATION"}</span>
    <h1>{preview ? "Your application is ready" : application?.status === "VERIFIED" ? "Your credentials are approved" : application?.submittedAt ? "Application submitted successfully" : application ? "Upload your credentials" : verified ? "Email verified" : verification ? "Verify your email" : "Verify email, then upload credentials"}</h1>
    <p>{preview ? "No account has been created, no documents uploaded and no email sent in this local preview." : verified ? "Your email is verified. Sign in with the password you chose to upload your credentials." : application?.status === "VERIFIED" ? "Sabi operations has approved your credentials. Sign in again to open your professional workspace." : "Choose the required documents below. They upload automatically and are checked for malware in the background. Sabi operations will preview and review them in Command Center."}</p>
    {application?.submittedAt && application.status === "PENDING" && <section className="sh-submission-success" role="status"><h2>Thank you — we have received your application</h2><p>Your documents have been sent to Sabi operations for review. You do not need to upload them again. We will email you when your doctor workspace is approved.</p><p>Submitted: {new Date(application.submittedAt).toLocaleString()}<br />Reference: {application.applicationId}</p></section>}
    {notice && <div className="sh-form-notice" role="status">{notice}</div>}
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
      <p><strong>{application.stage || application.status}</strong> · {application.email}</p>
      {application.decisionReason && <p className="sh-form-notice">Staff review: {application.decisionReason}</p>}
      {application.applicationId && ["PENDING", "REJECTED"].includes(application.status) && <>
        <ApplicationDetailsEditor key={application.applicationId} application={application} busy={!!busy} onSave={patch=>action('details',async()=>{await doctorOnboardingRequest(`/doctors/applications/${application.applicationId}/details`,{method:'PATCH',body:JSON.stringify(patch)});revision.current+=1;await refresh();setNotice('Corrections saved. Review your documents and submit the application again.');})}/>
        <p>PDF, PNG or JPEG · up to {(application.maxUploadBytes / 1000000).toFixed(1)} MB each. Upload clear copies; no patient records. Replacing a document resets submission and that document’s review.</p>
        {required.map(([kind, label]) => {
          const document = application.credentials.find((item) => item.kind === kind);
          return <CredentialUpload key={kind} kind={kind} label={label} document={document} file={files[kind]} maxBytes={application.maxUploadBytes} busy={busy}
            uploadError={uploadErrors[kind]} onSelect={selectFile}
            onRetry={(selectedKind, file) => action(selectedKind, () => upload(selectedKind, file))} />;
        })}
        {!application.submittedAt && <button className="sh-primary-button" disabled={!!busy || Object.values(uploadErrors).some(Boolean) || Object.values(files).some((file) => documentError(file, application.maxUploadBytes)) || required.some(([kind]) => !application.credentials.some(doc => doc.kind === kind))} onClick={() => action("submit", async () => { const response = await doctorOnboardingRequest(`/doctors/applications/${application.applicationId}/submit`, { method: "POST", body: "{}" }); revision.current += 1; setApplication((current) => ({ ...current, submittedAt: response.data?.submittedAt || new Date().toISOString() })); await refresh(); setNotice("Your application was submitted successfully. Sabi operations will review your documents."); window.scrollTo({ top: 0, behavior: "smooth" }); })}>{busy === "submit" ? "Submitting…" : "Submit application"}</button>}
      </>}
      <button className="sh-inline-link" disabled={loading || !!busy} onClick={() => refresh()}>Refresh application status</button>
    </>}
    <div className="sh-status-links"><Link to={preview ? "/register" : "/login"}>{preview ? "Start a new application" : "Sign in"}</Link><Link to="/register">Professional registration</Link>{preview && <Link to="/preview">Explore local preview</Link>}</div>
  </div></AuthLayout>;
}
