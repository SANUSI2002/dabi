// Rider sign-up and application. Designed to feel short and calm: one small step at a time, a clear
// list of what is needed up front, plain-language statuses, and always one obvious next action.
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useMatch, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Bike, Car, Check, CheckCircle2, ChevronDown, Clock3, FileText, LoaderCircle, LogOut, MailCheck,
  PartyPopper, RefreshCw, ShieldCheck, UploadCloud,
} from "lucide-react";
import { liveApiRequest, liveSignIn, liveSignOut, restoreLiveIdentity, type LiveApiError, type LiveIdentity } from "@/identity/liveIdentity";
import { getLive, writeLive } from "./riderApi";
import type { RiderApplication, RiderCredential, RiderRegistrationConfig } from "./onboardingTypes";
import "./rider.css";
import { RiderAuthLayout, RiderPasswordField, strongPassword } from "./RiderAuthLayout";
import { RiderApplicationSkeleton, RiderFormSkeleton } from "./RiderLoading";

const root = "/api/v1/riders";
type Profile = { fullName: string; phone: string; state: string; city: string; vehicleType: string; licenceExpiresAt: string; insuranceExpiresAt: string };
const empty: Profile = { fullName: "", phone: "", state: "", city: "", vehicleType: "MOTORCYCLE", licenceExpiresAt: "", insuranceExpiresAt: "" };
const NIGERIAN_STATES = ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"];
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const longDate = (iso: string) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : "—");
const VEHICLES: Record<string, string> = { MOTORCYCLE: "Motorcycle", CAR: "Car" };

// ------------------------------------------------------------------------------------------------
// Plain-language statuses
// ------------------------------------------------------------------------------------------------
const APPLICATION_STATUS: Record<string, { label: string; tone: string; message: string }> = {
  DRAFT: { label: "In progress", tone: "is-info", message: "Add your documents, then send your application for review." },
  SUBMITTED: { label: "Under review", tone: "is-warn", message: "Nothing to do right now. Sabi is reviewing your application and will email you." },
  CHANGES_REQUESTED: { label: "Changes needed", tone: "is-accent", message: "Sabi asked for a change. Update what is listed below, then send it again." },
  REJECTED: { label: "Not approved", tone: "is-danger", message: "Your application was not approved. You can update it and apply again." },
  APPROVED: { label: "Approved", tone: "is-success", message: "You are approved to deliver with Sabi. Sign in to your rider portal to start." },
  SUSPENDED: { label: "Paused", tone: "is-danger", message: "Your rider access is paused. Sabi operations will contact you." },
};
const statusOf = (status: string) => APPLICATION_STATUS[status] ?? { label: status.replaceAll("_", " ").toLowerCase(), tone: "is-neutral", message: "" };

function docState(doc: RiderCredential | undefined): { label: string; tone: string; help?: string; replace: boolean } {
  if (!doc) return { label: "Not added yet", tone: "is-neutral", replace: false };
  if (["INFECTED", "REJECTED"].includes(doc.scanStatus)) return { label: "Needs a new file", tone: "is-danger", help: "This file did not pass the security check. Upload a safe replacement.", replace: true };
  if (["REJECTED", "CHANGES_REQUESTED"].includes(doc.reviewStatus)) return { label: "Needs a new file", tone: "is-danger", help: doc.note || "Sabi could not accept this document. Upload a clearer or current copy.", replace: true };
  if (doc.scanStatus === "FAILED") return { label: "Check couldn't finish", tone: "is-warn", help: "Our security check could not finish. Sabi can retry it, or you can upload the file again.", replace: true };
  if (doc.scanStatus === "PENDING") return { label: "Checking file…", tone: "is-info", replace: true };
  if (["VERIFIED", "APPROVED"].includes(doc.reviewStatus)) return { label: "Approved", tone: "is-success", replace: true };
  return { label: "Received", tone: "is-success", help: "Safe and received. Sabi will review it with your application.", replace: true };
}

// ------------------------------------------------------------------------------------------------
// Layout for signed-in application pages
// ------------------------------------------------------------------------------------------------
function ApplicationFrame({ children, onSignOut, busy }: { children: ReactNode; onSignOut: () => void; busy: boolean }) {
  return (
    <div className="sabi-rider rider-application">
      <header className="rider-application-header">
        <Link className="rider-brand" to="/rider/application">
          <span><Bike size={22} aria-hidden="true" /></span>
          <div><strong>Sabi Health</strong><small>RIDER APPLICATION</small></div>
        </Link>
        <button type="button" className="rider-button-ghost" disabled={busy} onClick={onSignOut}><LogOut size={17} aria-hidden="true" />Sign out</button>
      </header>
      <main className="rider-application-main">{children}</main>
    </div>
  );
}

function Messages({ error, notice }: { error: string; notice: string }) {
  return <>
    {error && <p className="rider-alert rider-alert-error" role="alert">{error}</p>}
    {notice && <p className="rider-notice" role="status"><CheckCircle2 size={18} aria-hidden="true" />{notice}</p>}
  </>;
}

// ------------------------------------------------------------------------------------------------
// Sign-up wizard
// ------------------------------------------------------------------------------------------------
type WizardProps = {
  registering: boolean; config: RiderRegistrationConfig | null; busy: boolean;
  create: (values: { email: string; password: string; profile: Profile }) => void;
};

function SignUpWizard({ registering, config, busy, create }: WizardProps) {
  const steps = registering ? ["Account", "About you", "Your vehicle", "Review"] : ["About you", "Your vehicle", "Review"];
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<Profile>(empty);
  const [consent, setConsent] = useState(false);
  const [minimumExpiry] = useState(tomorrow);
  const heading = useRef<HTMLHeadingElement>(null);
  const name = steps[step];
  const disabled = busy || !config?.enabled;
  const set = (patch: Partial<Profile>) => setProfile((p) => ({ ...p, ...patch }));
  const go = (next: number) => { setStep(next); requestAnimationFrame(() => heading.current?.focus()); };
  const next = (e: FormEvent) => { e.preventDefault(); if (name === "Account" && !strongPassword(password)) return; go(step + 1); };
  const goTo = (label: string) => go(steps.indexOf(label));
  const documents = config?.requirements.map((r) => r.label) ?? ["Driving licence", "Vehicle registration", "Vehicle insurance"];

  return (
    <div className="rider-stack">
      <div className="rider-stack-sm">
        <span className="rider-step-count">Step {step + 1} of {steps.length}</span>
        <ol className="rider-steps" style={{ ["--steps" as string]: steps.length }} aria-label="Sign-up progress">
          {steps.map((s, i) => <li key={s} className={i < step ? "is-done" : i === step ? "is-current" : ""} aria-current={i === step ? "step" : undefined}>{s}</li>)}
        </ol>
      </div>
      {!config?.enabled && config && <p className="rider-alert rider-alert-warn" role="status">Registration is temporarily unavailable. Please try again later.</p>}
      <h2 ref={heading} tabIndex={-1} style={{ outline: "none" }}>
        {name === "Account" ? "Create your sign-in" : name === "About you" ? "Tell us about you" : name === "Your vehicle" ? "Your vehicle" : "Check and confirm"}
      </h2>

      {name === "Account" && (
        <form className="rider-form" onSubmit={next}>
          <div className="rider-checklist" role="note">
            <p className="rider-checklist-title">What you’ll need (about 5 minutes)</p>
            <ul className="rider-stack-sm" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              <li><Check size={16} aria-hidden="true" />An email address and phone number</li>
              <li><Check size={16} aria-hidden="true" />Expiry dates for your driving licence and vehicle insurance</li>
              <li><Check size={16} aria-hidden="true" />Photos or PDFs of: {documents.join(", ").toLowerCase()} — you can add these after signing up</li>
            </ul>
          </div>
          <div className="rider-field">
            <label htmlFor="rider-signup-email">Email address</label>
            <input id="rider-signup-email" required type="email" autoComplete="email" value={email} disabled={disabled} onChange={(e) => setEmail(e.target.value)} />
            <small>We’ll send a link to confirm it.</small>
          </div>
          <RiderPasswordField id="rider-signup-password" value={password} onChange={setPassword} disabled={disabled} newPassword />
          <WizardNav disabled={disabled || !strongPassword(password)} />
          <p className="rider-muted" style={{ fontSize: ".9rem" }}>Already have a Sabi account? <Link to="/rider/application">Sign in to apply</Link></p>
        </form>
      )}

      {name === "About you" && (
        <form className="rider-form" onSubmit={next}>
          <div className="rider-field"><label htmlFor="rider-full-name">Full name</label><input id="rider-full-name" required maxLength={160} autoComplete="name" value={profile.fullName} disabled={disabled} onChange={(e) => set({ fullName: e.target.value })} /><small>As it appears on your driving licence.</small></div>
          <div className="rider-field"><label htmlFor="rider-phone">Phone number</label><input id="rider-phone" required type="tel" inputMode="tel" maxLength={30} autoComplete="tel" placeholder="0801 234 5678" value={profile.phone} disabled={disabled} onChange={(e) => set({ phone: e.target.value })} /></div>
          <div className="rider-fields-2">
            <div className="rider-field"><label htmlFor="rider-state">State</label><input id="rider-state" required list="rider-states" maxLength={100} autoComplete="address-level1" value={profile.state} disabled={disabled} onChange={(e) => set({ state: e.target.value })} /><datalist id="rider-states">{NIGERIAN_STATES.map((s) => <option key={s} value={s} />)}</datalist></div>
            <div className="rider-field"><label htmlFor="rider-city">City</label><input id="rider-city" required maxLength={100} autoComplete="address-level2" value={profile.city} disabled={disabled} onChange={(e) => set({ city: e.target.value })} /><small>Where you will deliver.</small></div>
          </div>
          <WizardNav back={step > 0 ? () => go(step - 1) : undefined} disabled={disabled} />
        </form>
      )}

      {name === "Your vehicle" && (
        <form className="rider-form" onSubmit={next}>
          <fieldset>
            <legend>What will you ride?</legend>
            <div className="rider-choices">
              {[["MOTORCYCLE", "Motorcycle", Bike], ["CAR", "Car", Car]].map(([value, label, Icon]) => {
                const Glyph = Icon as typeof Bike;
                return <label key={String(value)} className="rider-choice"><input type="radio" name="vehicleType" value={String(value)} checked={profile.vehicleType === value} disabled={disabled} onChange={() => set({ vehicleType: String(value) })} /><Glyph size={30} aria-hidden="true" />{String(label)}</label>;
              })}
            </div>
          </fieldset>
          <div className="rider-fields-2">
            <div className="rider-field"><label htmlFor="rider-licence-expiry">Driving licence expiry</label><input id="rider-licence-expiry" required type="date" min={minimumExpiry} value={profile.licenceExpiresAt} disabled={disabled} onChange={(e) => set({ licenceExpiresAt: e.target.value })} /><small>It must still be valid.</small></div>
            <div className="rider-field"><label htmlFor="rider-insurance-expiry">Insurance expiry</label><input id="rider-insurance-expiry" required type="date" min={minimumExpiry} value={profile.insuranceExpiresAt} disabled={disabled} onChange={(e) => set({ insuranceExpiresAt: e.target.value })} /></div>
          </div>
          <WizardNav back={() => go(step - 1)} disabled={disabled} />
        </form>
      )}

      {name === "Review" && (
        <form className="rider-form" onSubmit={(e) => { e.preventDefault(); create({ email, password, profile }); }}>
          <dl className="rider-review">
            {registering && <ReviewRow label="Email address" value={email} onEdit={() => goTo("Account")} />}
            <ReviewRow label="Full name" value={profile.fullName} onEdit={() => goTo("About you")} />
            <ReviewRow label="Phone number" value={profile.phone} onEdit={() => goTo("About you")} />
            <ReviewRow label="Area" value={`${profile.city}, ${profile.state}`} onEdit={() => goTo("About you")} />
            <ReviewRow label="Vehicle" value={VEHICLES[profile.vehicleType] ?? profile.vehicleType} onEdit={() => goTo("Your vehicle")} />
            <ReviewRow label="Licence and insurance expiry" value={`${longDate(profile.licenceExpiresAt)} · ${longDate(profile.insuranceExpiresAt)}`} onEdit={() => goTo("Your vehicle")} />
          </dl>
          <label className="rider-consent">
            <input required type="checkbox" checked={consent} disabled={disabled} onChange={(e) => setConsent(e.target.checked)} />
            <span>I consent to credential verification and malware screening of my uploaded documents.</span>
          </label>
          <div className="rider-wizard-nav">
            <button type="button" className="rider-button-ghost" onClick={() => go(step - 1)}><ArrowLeft size={17} aria-hidden="true" />Back</button>
            <button className="rider-button rider-button-lg" disabled={disabled || !consent}>{busy ? <><LoaderCircle size={18} className="rider-spin" aria-hidden="true" />Creating…</> : registering ? "Create rider account" : "Create application"}</button>
          </div>
          <p className="rider-caption">Your account does not give delivery access yet. Sabi reviews your documents first.</p>
        </form>
      )}
    </div>
  );
}

function WizardNav({ back, disabled }: { back?: () => void; disabled: boolean }) {
  return <div className="rider-wizard-nav">
    {back ? <button type="button" className="rider-button-ghost" onClick={back}><ArrowLeft size={17} aria-hidden="true" />Back</button> : <span />}
    <button className="rider-button rider-button-lg" disabled={disabled}>Continue<ArrowRight size={18} aria-hidden="true" /></button>
  </div>;
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return <div><dt>{label}</dt><dd>{value || "—"}</dd><button type="button" className="rider-button-ghost" onClick={onEdit} aria-label={`Change ${label.toLowerCase()}`}>Change</button></div>;
}

// ------------------------------------------------------------------------------------------------
// Signed-in application
// ------------------------------------------------------------------------------------------------
function Tracker({ application }: { application: RiderApplication }) {
  const docsDone = application.requirements.every((r) => application.credentials.some((d) => d.kind === r.kind));
  const docsAttention = application.credentials.some((d) => docState(d).tone === "is-danger");
  const s = application.status;
  const submitted = ["SUBMITTED", "APPROVED"].includes(s);
  const items: { title: string; text: string; state: "is-done" | "is-current" | "is-attention" | "" }[] = [
    { title: "Account and details", text: "Done", state: "is-done" },
    { title: "Upload documents", text: docsDone ? "All documents added" : `${application.credentials.length} of ${application.requirements.length} added`, state: docsAttention ? "is-attention" : docsDone ? "is-done" : "is-current" },
    { title: "Send for review", text: submitted ? "Sent" : docsDone ? "Ready to send" : "After your documents", state: submitted ? "is-done" : docsDone && !docsAttention ? "is-current" : "" },
    { title: "Sabi review", text: s === "SUBMITTED" ? "In progress — we’ll email you" : s === "APPROVED" ? "Approved" : ["CHANGES_REQUESTED", "REJECTED"].includes(s) ? "Action needed" : "Waiting", state: s === "APPROVED" ? "is-done" : s === "SUBMITTED" ? "is-current" : ["CHANGES_REQUESTED", "REJECTED"].includes(s) ? "is-attention" : "" },
    { title: "Start delivering", text: s === "APPROVED" ? "Sign in to your rider portal" : "After approval", state: s === "APPROVED" ? "is-current" : "" },
  ];
  return <ol className="rider-tracker" aria-label="Application progress">{items.map((item, i) => <li key={item.title} className={item.state} aria-current={item.state === "is-current" ? "step" : undefined}><span className="rider-tracker-dot">{item.state === "is-done" ? <Check size={16} aria-hidden="true" /> : i + 1}</span><div><strong>{item.title}</strong><span>{item.text}</span></div></li>)}</ol>;
}

function DocumentCard({ label, kind, doc, canEdit, busy, maxBytes, upload }: { label: string; kind: string; doc?: RiderCredential; canEdit: boolean; busy: boolean; maxBytes: number; upload: (kind: string, file: File | undefined) => void }) {
  const [over, setOver] = useState(false);
  const state = docState(doc);
  return (
    <section className="rider-doc" aria-label={label}>
      <div className="rider-doc-head">
        <span className={`rider-feature-icon${state.tone === "is-danger" ? " is-accent" : ""}`}>{doc ? <FileText size={20} aria-hidden="true" /> : <UploadCloud size={20} aria-hidden="true" />}</span>
        <div><strong>{label}</strong><small>Photo or PDF, up to {(maxBytes / 1024 / 1024).toFixed(1)} MB</small></div>
        <span className={`rider-chip ${state.tone}`}>{state.label === "Checking file…" && <LoaderCircle size={13} className="rider-spin" aria-hidden="true" />}{state.label}</span>
      </div>
      {state.help && <p className={state.tone === "is-danger" ? "rider-alert rider-alert-warn" : "rider-muted"} style={state.tone === "is-danger" ? undefined : { fontSize: ".88rem" }}>{state.help}</p>}
      {canEdit && (
        <label className={`rider-drop${doc ? " is-compact" : ""}${over ? " is-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) upload(kind, e.dataTransfer.files?.[0]); }}>
          <UploadCloud size={doc ? 18 : 24} aria-hidden="true" />
          <span>{doc ? <><strong>Replace file</strong></> : <><strong>Choose document</strong> or drop it here</>}</span>
          <input aria-label={`${label} document`} disabled={busy} type="file" accept="application/pdf,image/png,image/jpeg"
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; void upload(kind, file); }} />
        </label>
      )}
    </section>
  );
}

function DetailsForm({ application, busy, consentVersion, save }: { application: RiderApplication; busy: boolean; consentVersion: string; save: (data: Profile & { consent: true; consentVersion: string }) => void }) {
  const [values, set] = useState<Profile>({
    fullName: application.fullName, phone: application.phone, state: application.state, city: application.city, vehicleType: application.vehicleType,
    licenceExpiresAt: application.licenceExpiresAt.slice(0, 10), insuranceExpiresAt: application.insuranceExpiresAt.slice(0, 10),
  });
  const [minimumExpiry] = useState(tomorrow);
  const patch = (p: Partial<Profile>) => set((v) => ({ ...v, ...p }));
  return (
    <form className="rider-form" onSubmit={(e) => { e.preventDefault(); save({ ...values, consent: true, consentVersion }); }}>
      <fieldset disabled={busy}>
        <div className="rider-fields-2">
          <div className="rider-field"><label htmlFor="edit-full-name">Full name</label><input id="edit-full-name" required maxLength={160} value={values.fullName} onChange={(e) => patch({ fullName: e.target.value })} /></div>
          <div className="rider-field"><label htmlFor="edit-phone">Phone number</label><input id="edit-phone" required type="tel" maxLength={30} value={values.phone} onChange={(e) => patch({ phone: e.target.value })} /></div>
          <div className="rider-field"><label htmlFor="edit-state">State</label><input id="edit-state" required list="rider-states-edit" maxLength={100} value={values.state} onChange={(e) => patch({ state: e.target.value })} /><datalist id="rider-states-edit">{NIGERIAN_STATES.map((s) => <option key={s} value={s} />)}</datalist></div>
          <div className="rider-field"><label htmlFor="edit-city">City</label><input id="edit-city" required maxLength={100} value={values.city} onChange={(e) => patch({ city: e.target.value })} /></div>
          <div className="rider-field"><label htmlFor="edit-vehicle">Vehicle type</label><select id="edit-vehicle" value={values.vehicleType} onChange={(e) => patch({ vehicleType: e.target.value })}><option value="MOTORCYCLE">Motorcycle</option><option value="CAR">Car</option></select></div>
          <div className="rider-field"><label htmlFor="edit-licence">Driving licence expiry</label><input id="edit-licence" required type="date" min={minimumExpiry} value={values.licenceExpiresAt} onChange={(e) => patch({ licenceExpiresAt: e.target.value })} /></div>
          <div className="rider-field"><label htmlFor="edit-insurance">Insurance expiry</label><input id="edit-insurance" required type="date" min={minimumExpiry} value={values.insuranceExpiresAt} onChange={(e) => patch({ insuranceExpiresAt: e.target.value })} /></div>
        </div>
      </fieldset>
      <p className="rider-alert rider-alert-info" role="note">Saving changes sends your application back to draft. Check your documents, then send it again.</p>
      <div><button className="rider-button-secondary" disabled={busy}>Save details</button></div>
    </form>
  );
}

function ApplicationView({ application, busy, config, upload, submit, saveDetails, refresh }: {
  application: RiderApplication; busy: boolean; config: RiderRegistrationConfig | null;
  upload: (kind: string, file: File | undefined) => void; submit: () => void; saveDetails: (data: Profile & { consent: true; consentVersion: string }) => void; refresh: () => void;
}) {
  const status = statusOf(application.status);
  const canEdit = ["DRAFT", "SUBMITTED", "CHANGES_REQUESTED", "REJECTED", "APPROVED"].includes(application.status);
  const missing = application.requirements.filter((r) => !application.credentials.some((d) => d.kind === r.kind)).length;
  const firstName = application.fullName.split(" ")[0] || "there";
  return (
    <>
      <section className="rider-card rider-application-hero">
        <div className="rider-card-head" style={{ marginBottom: 0 }}>
          <div><p className="rider-eyebrow">Your rider application</p><h1>Hi {firstName}.</h1></div>
          <span className={`rider-chip ${status.tone}`}>{status.label}</span>
        </div>
        {status.message && <p className="rider-muted">{status.message}</p>}
        {application.decisionReason && <p className="rider-alert rider-alert-warn"><span><strong>Note from Sabi:</strong> {application.decisionReason}</span></p>}
        {application.status === "APPROVED" && <>
          <p className="rider-caption">Updating your details or replacing a document pauses delivery access until the renewed application is approved.</p>
          <Link className="rider-button rider-button-lg" to="/rider/login">Sign in to deliveries<ArrowRight size={18} aria-hidden="true" /></Link>
        </>}
        <div className="rider-actions">
          <button type="button" className="rider-button-ghost" disabled={busy} onClick={refresh}><RefreshCw size={16} aria-hidden="true" />Refresh status</button>
          <span className="rider-caption">Reference {application.id.slice(0, 8).toUpperCase()}</span>
        </div>
      </section>

      <section className="rider-card"><h2 style={{ marginBottom: 14 }}>Your progress</h2><Tracker application={application} /></section>

      <section className="rider-stack-sm" aria-label="Documents">
        <div className="rider-section-heading"><h2>Documents</h2><span className="rider-caption">{application.credentials.length} of {application.requirements.length} added</span></div>
        <div className="rider-docs">
          {application.requirements.map((r) => <DocumentCard key={r.kind} label={r.label} kind={r.kind} doc={application.credentials.find((d) => d.kind === r.kind)} canEdit={canEdit} busy={busy} maxBytes={application.maxUploadBytes} upload={upload} />)}
        </div>
        {canEdit && <p className="rider-caption"><ShieldCheck size={14} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Files upload as soon as you choose them and are scanned for safety. You can leave and come back any time.</p>}
      </section>

      {canEdit && application.status !== "APPROVED" && (
        <div className="rider-submit-bar">
          <button className="rider-button rider-button-lg rider-block" disabled={busy || application.status === "SUBMITTED" || missing > 0} onClick={submit}>
            {busy ? "Saving…" : application.status === "SUBMITTED" ? "Submitted for review" : "Submit application"}
          </button>
          <p className="rider-caption" style={{ textAlign: "center" }}>
            {application.status === "SUBMITTED" ? <><Clock3 size={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Under review. We’ll email you with the outcome.</> : missing > 0 ? `Add ${missing} more document${missing === 1 ? "" : "s"} to submit.` : "Everything’s ready. Send it when you are."}
          </p>
        </div>
      )}

      <details className="rider-card">
        <summary>Your details<ChevronDown size={18} aria-hidden="true" /></summary>
        <div className="rider-stack">
          <dl className="rider-kv">
            <div><dt>Name</dt><dd>{application.fullName}</dd></div>
            <div><dt>Email</dt><dd>{application.email}</dd></div>
            <div><dt>Phone</dt><dd>{application.phone}</dd></div>
            <div><dt>Area</dt><dd>{application.city}, {application.state}</dd></div>
            <div><dt>Vehicle</dt><dd>{VEHICLES[application.vehicleType] ?? application.vehicleType}</dd></div>
            <div><dt>Licence · insurance expiry</dt><dd>{longDate(application.licenceExpiresAt)} · {longDate(application.insuranceExpiresAt)}</dd></div>
          </dl>
          {canEdit && <details>
            <summary className="rider-text-link">Edit rider or expiry details</summary>
            <div style={{ marginTop: 12 }}><DetailsForm application={application} busy={busy} consentVersion={config?.consentVersion || ""} save={saveDetails} /></div>
          </details>}
        </div>
      </details>
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// Page
// ------------------------------------------------------------------------------------------------
export default function RiderOnboarding() {
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const verifyRoute = useMatch("/rider/verify-email/:uid");
  const registering = pathname === "/rider/register";
  const [token, setToken] = useState(hash.slice(1));
  const verifyUid = verifyRoute?.params.uid;
  const [config, setConfig] = useState<RiderRegistrationConfig | null>(null);
  const [identity, setIdentity] = useState<LiveIdentity | null>(null);
  const [application, setApplication] = useState<RiderApplication | null>(null);
  const scanning = !!application?.credentials.some((d) => d.scanStatus === "PENDING");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState(false);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const gate = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try { setApplication(await getLive<RiderApplication>(`${root}/me`)); }
    catch (cause) { if ((cause as LiveApiError).status === 404) setApplication(null); else throw cause; }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true); setApplication(null); setError(""); setNotice(""); setCreated(false); setVerified(false);
    (async () => {
      try {
        const settings = await getLive<RiderRegistrationConfig>(`${root}/registration-config`);
        if (active) setConfig(settings);
        if (!registering && !verifyUid) {
          const current = await restoreLiveIdentity();
          if (active) { setIdentity(current); if (current) await refresh(); }
        }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Unable to load rider registration."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [registering, verifyUid, refresh]);

  useEffect(() => { if (verifyUid && hash) navigate(pathname, { replace: true }); }, [verifyUid, hash, pathname, navigate]);

  // While a file is being scanned, quietly refresh so its status updates on its own.
  useEffect(() => {
    if (!scanning || busy) return;
    let stopped = false, polling = false;
    const timer = setInterval(async () => {
      if (polling || gate.current || document.visibilityState !== "visible") return;
      polling = true;
      try { const app = await getLive<RiderApplication>(`${root}/me`); if (!stopped && !gate.current) setApplication(app); }
      catch (cause) { if (!stopped) setError(cause instanceof Error ? cause.message : "Unable to refresh screening."); }
      finally { polling = false; }
    }, 10000);
    return () => { stopped = true; clearInterval(timer); };
  }, [busy, scanning]);

  async function run(work: () => Promise<void>) {
    if (gate.current) return;
    gate.current = true; setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save. Please retry."); }
    finally { gate.current = false; setBusy(false); }
  }

  async function upload(kind: string, file: File | undefined) {
    if (!file || !application) return;
    await run(async () => {
      if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) throw new Error("Choose a PDF, PNG or JPEG file.");
      if (!file.size || file.size > application.maxUploadBytes) throw new Error(`Choose a file up to ${(application.maxUploadBytes / 1024 / 1024).toFixed(1)} MB.`);
      await liveApiRequest(`${root}/applications/${application.id}/credentials/${kind}`, { method: "PUT", headers: { "Content-Type": file.type }, body: file, signal: AbortSignal.timeout(60000) });
      setNotice("Document received. We’re checking it now — you can keep going.");
      await refresh();
    });
  }

  const create = ({ email: newEmail, password: newPassword, profile }: { email: string; password: string; profile: Profile }) => run(async () => {
    if (!config?.enabled) throw new Error("Registration is temporarily unavailable.");
    const data = { ...profile, consent: true, consentVersion: config.consentVersion };
    if (registering) {
      const result = await writeLive<{ emailSent: boolean }>(`${root}/register`, { ...data, email: newEmail, password: newPassword });
      setCreated(true);
      if (!result.emailSent) setNotice("Your account was created, but the verification email was delayed. Request a new one from the sign-in page.");
    } else {
      await writeLive(`${root}/applications`, data);
      await refresh();
      setNotice("Application created. Add your documents below.");
    }
  });

  const signOut = () => run(async () => { await liveSignOut(); setIdentity(null); setApplication(null); });

  // ---- signed-in with an application -----------------------------------------------------------
  // The application page could open either signed in or not; show its outline until we know.
  if (loading && !registering && !verifyRoute) return <RiderApplicationSkeleton />;

  if (!loading && identity && application && !registering && !verifyRoute) {
    return (
      <ApplicationFrame onSignOut={signOut} busy={busy}>
        <Messages error={error} notice={notice} />
        <ApplicationView application={application} busy={busy} config={config} refresh={() => run(refresh)} upload={upload}
          submit={() => run(async () => {
            await writeLive(`${root}/applications/${application.id}/submit`, { version: application.version });
            setNotice(`Application submitted successfully. Reference: ${application.id}. We will email you when your review is complete.`);
            await refresh();
          })}
          saveDetails={(data) => run(async () => {
            await writeLive(`${root}/applications/${application.id}`, { ...data, version: application.version }, "PATCH");
            await refresh();
            setNotice("Details updated. Check your documents, then submit your application again.");
          })} />
      </ApplicationFrame>
    );
  }

  // ---- everything else uses the calm access layout --------------------------------------------
  const title = verifyRoute ? "Confirm your email" : created ? "You’re in. Check your email." : registering ? "Become a Sabi rider" : identity ? "Start your rider application" : "Sign in to your application";
  const lead = verifyRoute ? "One quick tap to secure your rider account." : created ? "" : registering ? "A few short steps. Save time by having your licence and insurance dates to hand." : identity ? "Just a couple of steps, then add your documents." : "See your progress, add documents and track your review.";
  return (
    <RiderAuthLayout registration={registering || (!!identity && !application)}>
      <div className="rider-stack-sm">
        <p className="rider-eyebrow">{verifyRoute ? "Account security" : "Sabi rider network"}</p>
        <h1>{title}</h1>
        {lead && <p className="rider-muted">{lead}</p>}
      </div>
      <Messages error={error} notice={notice} />
      {loading ? <RiderFormSkeleton fields={verifyRoute ? 0 : 2} />
        : verifyRoute ? (
          <section className="rider-celebrate">
            {verified ? <>
              <CheckCircle2 size={44} aria-hidden="true" />
              <h2>Email verified</h2>
              <p className="rider-muted">Next, sign in and add your documents.</p>
              <Link className="rider-button rider-button-lg" to="/rider/application">Continue to application<ArrowRight size={18} aria-hidden="true" /></Link>
            </> : <>
              <MailCheck size={44} aria-hidden="true" style={{ color: "var(--r-primary)" }} />
              <h2>Confirm your email address</h2>
              <p className="rider-muted">Tap below to finish. Links expire after 24 hours.</p>
              <button className="rider-button rider-button-lg" disabled={busy || !token} onClick={() => run(async () => {
                await writeLive(`${root}/verify-email`, { uid: verifyRoute.params.uid, token });
                setToken(""); navigate(pathname, { replace: true }); setVerified(true);
              })}>{busy ? "Verifying…" : "Verify email"}</button>
              <Link className="rider-text-link" to="/rider/application">Link expired? Request a new email</Link>
            </>}
          </section>
        ) : created ? (
          <section className="rider-celebrate" role="status">
            <PartyPopper size={44} aria-hidden="true" />
            <h2>Account created. Check your email.</h2>
            <ol className="rider-next-steps">
              <li><div><strong>Confirm your email</strong><span className="rider-muted">Tap the link we just sent you.</span></div></li>
              <li><div><strong>Add your documents</strong><span className="rider-muted">Sign in and upload your licence, registration and insurance.</span></div></li>
              <li><div><strong>Get approved</strong><span className="rider-muted">Sabi reviews your application and emails you. Deliveries start after approval.</span></div></li>
            </ol>
            <Link className="rider-button rider-button-lg" to="/rider/application">Continue<ArrowRight size={18} aria-hidden="true" /></Link>
          </section>
        ) : registering || (identity && !application) ? (
          <SignUpWizard registering={registering} config={config} busy={busy} create={create} />
        ) : (
          <section className="rider-stack">
            <form className="rider-form" onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const result = await liveSignIn(email, password);
                setPassword("");
                if (result.kind === "MFA") { navigate("/mfa?context=rider-onboarding"); return; }
                setIdentity(result.identity);
                await refresh();
              });
            }}>
              <div className="rider-field"><label htmlFor="rider-application-email">Email address</label><input id="rider-application-email" required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <RiderPasswordField id="rider-application-password" value={password} onChange={setPassword} disabled={busy} />
              <button className="rider-button rider-button-lg" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
            </form>
            <div className="rider-actions" style={{ justifyContent: "space-between" }}>
              <Link className="rider-text-link" to="/forgot-password">Forgot password?</Link>
              <Link className="rider-text-link" to="/rider/register">Create an account</Link>
            </div>
            <div className="rider-card" style={{ boxShadow: "none", background: "var(--r-sunken)" }}>
              <p className="rider-muted" style={{ fontSize: ".9rem" }}>Didn’t get your verification email? Enter your email above, then:</p>
              <button className="rider-button-secondary" style={{ marginTop: 10 }} disabled={busy || !email} onClick={() => run(async () => {
                const response = await writeLive<{ message: string }>(`${root}/resend-verification`, { email });
                setNotice(response.message);
              })}>Resend verification email</button>
            </div>
          </section>
        )}
    </RiderAuthLayout>
  );
}
