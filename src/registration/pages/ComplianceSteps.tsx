import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, BadgeCheck, Building2, Check, FileCheck2, FileUp, Loader2, ShieldCheck, Trash2, UserRoundCheck } from "lucide-react";
import { REGULATORS, resolveComplianceRequirements } from "@/compliance/rules";
import { corporateVerificationProvider, documentVerificationProvider, facilityVerificationProvider, professionalVerificationProvider } from "@/compliance/providers";
import { useComplianceUploads } from "@/compliance/useComplianceUploads";
import { apiConfigured } from "@/config/runtime";
import type { OrganizationApplication } from "../domain";

export type ComplianceStepProps = {
  application: OrganizationApplication;
  update: (updater: (item: OrganizationApplication) => OrganizationApplication) => void;
  onNext: () => void;
  setMessage: (message: string) => void;
};

function Header({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="mb-7"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-brand-700">{eyebrow}</p><h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.035em] text-slate-950">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{copy}</p></div>;
}

function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return <label className={`block ${wide ? "sm:col-span-2" : ""}`}><span className="label">{label}</span>{children}{hint && <span className="mt-1.5 block text-xs leading-5 text-slate-400">{hint}</span>}</label>;
}

function ContinueButton({ busy }: { busy?: boolean }) {
  return <button disabled={busy} className="public-button-primary mt-7 w-full sm:w-auto" type="submit">{busy ? <Loader2 size={16} className="animate-spin"/> : <ShieldCheck size={16}/>} Save compliance details</button>;
}

function ManualReviewNotice({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><AlertTriangle size={18} className="mt-0.5 shrink-0"/><span>{children}</span></div>;
}

export function CorporateStep({ application, update, onNext, setMessage }: ComplianceStepProps) {
  const corporate = application.corporate;
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const setCorporate = (patch: Partial<typeof corporate>) => update((item) => ({ ...item, corporate: { ...item.corporate, ...patch } }));
  async function requestCheck() {
    if (!corporate.registrationNumber || !corporate.registeredLegalName) return setMessage("Provide the registration number and registered legal name first.");
    setBusy(true); setMessage("");
    const response = await corporateVerificationProvider.verify({ registrationNumber: corporate.registrationNumber, legalName: corporate.registeredLegalName, country: application.organization.country });
    update((item) => ({ ...item, verification: { ...item.verification, corporate: response.status } }));
    setResult(response.message); setBusy(false);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (corporate.incorporationDate && new Date(corporate.incorporationDate).getTime() > Date.now()) return setMessage("The incorporation date cannot be in the future.");
    if (application.organization.ownershipType !== "Public" && (!corporate.registrationNumber || !corporate.registeredLegalName)) return setMessage("Provide the applicable corporate registration details.");
    onNext();
  }
  return <><Header eyebrow="Step 3 · Corporate identity" title="Describe the registered organization." copy="Registration formats are normalized for review but never treated as proof. Only an authorized backend provider or reviewer can verify corporate identity."/><form onSubmit={submit}><div className="grid gap-5 sm:grid-cols-2"><Field label="Corporate registration number"><input required={application.organization.ownershipType !== "Public"} className="input" value={corporate.registrationNumber} onChange={(e) => setCorporate({ registrationNumber: e.target.value.toUpperCase().trimStart() })}/></Field><Field label="Registered legal name"><input required={application.organization.ownershipType !== "Public"} className="input" value={corporate.registeredLegalName} onChange={(e) => setCorporate({ registeredLegalName: e.target.value })}/></Field><Field label="Type of registration"><select className="input" value={corporate.registrationType} onChange={(e) => setCorporate({ registrationType: e.target.value })}><option>Company</option><option>Business name</option><option>Incorporated trustees</option><option>Government establishment</option><option>Other</option></select></Field><Field label="Tax identification number"><input className="input" value={corporate.taxIdentificationNumber} onChange={(e) => setCorporate({ taxIdentificationNumber: e.target.value.toUpperCase().trimStart() })}/></Field><Field label="Date of incorporation"><input type="date" className="input" max={new Date().toISOString().slice(0, 10)} value={corporate.incorporationDate} onChange={(e) => setCorporate({ incorporationDate: e.target.value })}/></Field></div><button type="button" disabled={busy} onClick={requestCheck} className="public-button-secondary mt-6"><BadgeCheck size={16}/>{busy ? "Requesting…" : "Request corporate verification"}</button>{result && <ManualReviewNotice><b>Manual review required.</b> {result}</ManualReviewNotice>}<ContinueButton busy={busy}/></form></>;
}

export function RegulationStep({ application, update, onNext, setMessage }: ComplianceStepProps) {
  const registration = application.regulatoryRegistration;
  const resolved = useMemo(() => resolveComplianceRequirements(application), [application]);
  const facilityRegulators = resolved.regulators.filter((item) => item.scope === "FACILITY");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const setRegistration = (patch: Partial<typeof registration>) => update((item) => ({ ...item, regulatoryRegistration: { ...item.regulatoryRegistration, ...patch } }));
  async function requestCheck() {
    if (!registration.registrationNumber) return setMessage("Provide the facility registration or licence number first.");
    const regulator = REGULATORS.find((item) => item.id === registration.regulatorId);
    setBusy(true); setMessage("");
    const response = await facilityVerificationProvider.verify({ licenceNumber: registration.registrationNumber, regulator: regulator?.shortName ?? "Facility regulator", facilityName: application.organization.tradingName, jurisdiction: resolved.jurisdiction?.name ?? application.organization.country });
    update((item) => ({ ...item, verification: { ...item.verification, facility: response.status } }));
    setResult(response.message); setBusy(false);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!registration.regulatorId || !registration.registrationNumber || !registration.facilityCategory) return setMessage("Provide the regulator, registration number and facility category.");
    if (registration.dateIssued && registration.expiryDate && registration.expiryDate < registration.dateIssued) return setMessage("The licence expiry date cannot precede its issue date.");
    if (registration.expiryDate && registration.expiryDate < new Date().toISOString().slice(0, 10)) update((item) => ({ ...item, verification: { ...item.verification, facility: "EXPIRED" } }));
    onNext();
  }
  return <><Header eyebrow="Step 4 · Facility regulation" title="Provide the facility’s regulatory details." copy={`Requirements are resolving from ${resolved.jurisdiction?.name ?? "a manual-review jurisdiction"} and ${application.organization.facilityType}. Regulatory approval remains the responsibility of the relevant authority.`}/>{resolved.fallback && <ManualReviewNotice>No active requirement set matches this jurisdiction and facility type. The application will require manual configuration review.</ManualReviewNotice>}<form onSubmit={submit} className="mt-6"><div className="grid gap-5 sm:grid-cols-2"><Field label="Registration context"><select className="input" value={registration.registrationStatus} onChange={(e) => setRegistration({ registrationStatus: e.target.value as typeof registration.registrationStatus })}><option value="NEW">New facility registration</option><option value="EXISTING">Existing or renewal</option></select></Field><Field label="Regulatory body"><select required className="input" value={registration.regulatorId} onChange={(e) => setRegistration({ regulatorId: e.target.value })}>{facilityRegulators.length ? facilityRegulators.map((item) => <option value={item.id} key={item.id}>{item.shortName} — {item.name}</option>) : <option value="manual">Manual review / regulator not configured</option>}</select></Field><Field label="Facility registration / licence number"><input required className="input" value={registration.registrationNumber} onChange={(e) => setRegistration({ registrationNumber: e.target.value.toUpperCase().trimStart() })}/></Field><Field label="Facility category"><input required className="input" value={registration.facilityCategory} onChange={(e) => setRegistration({ facilityCategory: e.target.value })}/></Field><Field label="Date issued"><input type="date" className="input" value={registration.dateIssued} onChange={(e) => setRegistration({ dateIssued: e.target.value })}/></Field><Field label="Expiry date"><input type="date" className="input" value={registration.expiryDate} onChange={(e) => setRegistration({ expiryDate: e.target.value })}/></Field><Field label="Declared current status"><select className="input" value={registration.currentStatus} onChange={(e) => setRegistration({ currentStatus: e.target.value })}><option>Active</option><option>Pending renewal</option><option>Expired</option><option>Provisional</option><option>Not known</option></select></Field></div><button type="button" disabled={busy} onClick={requestCheck} className="public-button-secondary mt-6"><Building2 size={16}/>{busy ? "Requesting…" : "Request facility verification"}</button>{result && <ManualReviewNotice><b>Manual review required.</b> {result}</ManualReviewNotice>}<ContinueButton busy={busy}/></form></>;
}

export function OfficerStep({ application, update, onNext, setMessage }: ComplianceStepProps) {
  const officer = application.operatingOfficer;
  const professionalRegulators = REGULATORS.filter((item) => item.scope === "PROFESSIONAL");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const setOfficer = (patch: Partial<typeof officer>) => update((item) => ({ ...item, operatingOfficer: { ...item.operatingOfficer, ...patch } }));
  async function requestCheck() {
    if (!officer.registrationNumber || !officer.practisingLicenceNumber || !officer.fullName) return setMessage("Provide the officer’s name, registration number and practising licence number first.");
    const regulator = REGULATORS.find((item) => item.id === officer.regulatorId);
    setBusy(true); setMessage("");
    const response = await professionalVerificationProvider.verify({ registrationNumber: officer.registrationNumber, licenceNumber: officer.practisingLicenceNumber, regulator: regulator?.shortName ?? "Professional regulator", fullName: officer.fullName });
    update((item) => ({ ...item, verification: { ...item.verification, operatingOfficer: response.status } }));
    setResult(response.message); setBusy(false);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!officer.fullName || !officer.registrationNumber || !officer.practisingLicenceNumber || !officer.licenceExpiryDate) return setMessage("Complete the operating-officer identity and licence information.");
    if (officer.licenceExpiryDate < new Date().toISOString().slice(0, 10)) update((item) => ({ ...item, verification: { ...item.verification, operatingOfficer: "EXPIRED" } }));
    onNext();
  }
  return <><Header eyebrow="Step 5 · Operating officer" title="Who is clinically responsible for this facility?" copy="Professional credentials remain attached to the verification case even when a licence is expired. Sabi never silently removes the person or marks them verified from browser data."/><form onSubmit={submit}><div className="grid gap-5 sm:grid-cols-2"><Field label="Full name"><input required className="input" autoComplete="name" value={officer.fullName} onChange={(e) => setOfficer({ fullName: e.target.value })}/></Field><Field label="Role"><input required className="input" value={officer.role} onChange={(e) => setOfficer({ role: e.target.value })}/></Field><Field label="Profession"><select className="input" value={officer.profession} onChange={(e) => setOfficer({ profession: e.target.value })}><option>Medical Practitioner</option><option>Dentist</option><option>Nurse</option><option>Midwife</option><option>Laboratory Scientist</option><option>Other regulated professional</option></select></Field><Field label="Professional regulatory body"><select className="input" value={officer.regulatorId} onChange={(e) => setOfficer({ regulatorId: e.target.value })}>{professionalRegulators.map((item) => <option value={item.id} key={item.id}>{item.shortName} — {item.name}</option>)}</select></Field><Field label="Professional registration / folio number"><input required className="input" value={officer.registrationNumber} onChange={(e) => setOfficer({ registrationNumber: e.target.value.toUpperCase().trimStart() })}/></Field><Field label="Practising licence number"><input required className="input" value={officer.practisingLicenceNumber} onChange={(e) => setOfficer({ practisingLicenceNumber: e.target.value.toUpperCase().trimStart() })}/></Field><Field label="Licence expiry date"><input required type="date" className="input" value={officer.licenceExpiryDate} onChange={(e) => setOfficer({ licenceExpiryDate: e.target.value })}/></Field><Field label="Email"><input required type="email" className="input" autoComplete="email" value={officer.email} onChange={(e) => setOfficer({ email: e.target.value })}/></Field><Field label="Phone"><input required type="tel" className="input" autoComplete="tel" value={officer.phone} onChange={(e) => setOfficer({ phone: e.target.value })}/></Field></div><button type="button" disabled={busy} onClick={requestCheck} className="public-button-secondary mt-6"><UserRoundCheck size={16}/>{busy ? "Requesting…" : "Request professional verification"}</button>{result && <ManualReviewNotice><b>Manual review required.</b> {result}</ManualReviewNotice>}<ContinueButton busy={busy}/></form></>;
}

export function DocumentsStep(props: ComplianceStepProps) {
  return apiConfigured ? <LiveDocumentsStep application={props.application} onNext={props.onNext}/> : <FixtureDocumentsStep {...props}/>;
}

function LiveDocumentsStep({ application, onNext }: Pick<ComplianceStepProps, "application" | "onNext">) {
  const resolved = useMemo(() => resolveComplianceRequirements(application), [application]);
  return <>
    <Header eyebrow="Step 7 · Documents" title="Review the evidence you will need." copy="Secure document collection is not connected to this test release. Please do not select or upload files here. Sabi will request evidence through a secure workflow during review."/>
    <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50 p-5">
      <div className="flex items-start gap-3"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-700"/><div><h2 className="font-display font-bold text-brand-950">{resolved.jurisdiction?.name ?? "Manual-review jurisdiction"}</h2><p className="mt-1 text-sm leading-6 text-brand-900/65">{resolved.requirementSets.length ? resolved.requirementSets.map((set) => `${set.name} v${set.version}`).join(" · ") : "No active automatic requirement set"}</p></div></div>
    </div>
    {resolved.fallback ? <ManualReviewNotice>A reviewer will determine the applicable document requirements for this jurisdiction and facility type.</ManualReviewNotice> : <div className="space-y-3">{resolved.requirements.map((requirement) => <section key={requirement.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500"><FileCheck2 size={18}/></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-sm font-bold text-slate-900">{requirement.label}</h2><span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${requirement.required ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"}`}>{requirement.required ? "Required later" : "If available"}</span></div><p className="mt-1 text-xs leading-5 text-slate-500">{requirement.description}</p></div></div></section>)}</div>}
    <button type="button" onClick={onNext} className="public-button-primary mt-6">Continue without uploading</button>
  </>;
}

function FixtureDocumentsStep({ application, update, onNext, setMessage }: ComplianceStepProps) {
  const resolved = useMemo(() => resolveComplianceRequirements(application), [application]);
  const allDocuments = useComplianceUploads((state) => state.documents);
  const documents = useMemo(() => allDocuments.filter((item) => item.applicationId === application.id), [allDocuments, application.id]);
  const stageDocument = useComplianceUploads((state) => state.stageDocument);
  const removeDocument = useComplianceUploads((state) => state.removeDocument);
  const required = resolved.requirements.filter((item) => item.required);
  const missing = required.filter((item) => !documents.some((document) => document.requirementId === item.id && document.status === "STAGED"));
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!resolved.fallback && missing.length) return setMessage(`Stage ${missing.length} required document${missing.length === 1 ? "" : "s"} before continuing.`);
    setBusy(true); setMessage("");
    const response = await documentVerificationProvider.requestReview(application.id, documents.map((item) => item.requirementId));
    update((item) => ({ ...item, verification: { ...item.verification, facility: item.verification.facility === "EXPIRED" ? "EXPIRED" : response.status } }));
    setBusy(false); onNext();
  }
  return <><Header eyebrow="Step 7 · Documents" title="Stage the applicable compliance evidence." copy="Requirements are calculated from your application facts. Files are validated and retained only in this active browser session; a production secure-storage adapter will persist encrypted uploads and malware-scan results."/><div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50 p-5"><div className="flex items-start gap-3"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-700"/><div><h2 className="font-display font-bold text-brand-950">{resolved.jurisdiction?.name ?? "Manual-review jurisdiction"}</h2><p className="mt-1 text-sm leading-6 text-brand-900/65">{resolved.requirementSets.length ? resolved.requirementSets.map((set) => `${set.name} v${set.version}`).join(" · ") : "No active automatic requirement set"}</p></div></div></div>{resolved.fallback ? <ManualReviewNotice>No automatic document list is available. A compliance reviewer must configure the requirement set for this jurisdiction and facility type.</ManualReviewNotice> : <form onSubmit={submit}><div className="space-y-3">{resolved.requirements.map((requirement) => { const document = documents.find((item) => item.requirementId === requirement.id); return <section key={requirement.id} className={`rounded-2xl border p-4 ${document ? "border-brand-200 bg-brand-50/50" : "border-slate-200 bg-white"}`}><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${document ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"}`}>{document ? <Check size={18}/> : <FileCheck2 size={18}/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-sm font-bold text-slate-900">{requirement.label}</h2><span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${requirement.required ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"}`}>{requirement.required ? "Required" : "If available"}</span>{requirement.tracksExpiry && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-extrabold uppercase text-amber-700">Expiry tracked</span>}</div><p className="mt-1 text-xs leading-5 text-slate-500">{requirement.description}</p>{document ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 text-xs"><span className="min-w-0"><b className="block truncate text-slate-700">{document.filename}</b><span className="text-slate-400">{(document.size / 1024 / 1024).toFixed(2)} MB · Malware scan not run</span></span><button type="button" onClick={() => removeDocument(application.id, requirement.id)} aria-label={`Remove ${requirement.label}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={15}/></button></div> : <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-brand-700 hover:border-brand-300"><FileUp size={15}/>Choose document<input className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const result = stageDocument(application.id, requirement, file); setErrors((current) => ({ ...current, [requirement.id]: result.error ?? "" })); event.target.value = ""; }}/></label>}{errors[requirement.id] && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{errors[requirement.id]}</p>}</div></div></section>; })}</div><p className="mt-5 text-xs leading-5 text-slate-400">Leaving or refreshing this page clears staged files in this frontend prototype. No file content or filename is written to the application draft in localStorage.</p><button disabled={busy || missing.length > 0} className="public-button-primary mt-6 w-full sm:w-auto" type="submit">{busy ? <Loader2 size={16} className="animate-spin"/> : <FileCheck2 size={16}/>} Continue with {documents.length} staged</button></form>}{resolved.fallback && <button onClick={onNext} className="public-button-primary mt-6">Continue to manual review</button>}</>;
}
