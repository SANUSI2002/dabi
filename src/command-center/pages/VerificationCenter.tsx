import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, BadgeCheck, CheckCircle2, ClipboardCheck,
  Clock3, MessageSquareText, Search, ShieldAlert, UserRoundCheck, XCircle,
} from "lucide-react";
import { hasPermission } from "../access";
import { CommandButton, CommandInput, CommandPageHeader, CommandSelect, Panel, PanelHeader, StatusPill } from "../components/ui";
import { formatDate } from "../format";
import { useCommandCenter } from "../useCommandCenter";
import { useRegistration } from "@/registration/useRegistration";
import { getApprovalBlockers, useVerificationCenter } from "@/compliance/useVerificationCenter";
import type { VerificationCase } from "@/compliance/domain";
import { resolveComplianceRequirements } from "@/compliance/rules";
import { useAuth } from "@/store/useAuth";
import type { OrganizationApplication } from "@/registration/domain";
import { getSessionComplianceFile, useComplianceUploads } from "@/compliance/useComplianceUploads";

const ALL = "ALL";

export default function VerificationCenter() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const applications = useRegistration((state) => state.applications);
  const cases = useVerificationCenter((state) => state.cases);
  const syncApplications = useVerificationCenter((state) => state.syncApplications);
  const platformUsers = useCommandCenter((state) => state.platformUsers);
  const identity = useAuth((state) => state.identity);
  const actor = platformUsers.find((item) => item.id === identity?.platformUserId);
  const canManage = hasPermission(actor, "onboarding.manage");
  const canVerify = hasPermission(actor, "documents.verify");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(ALL);
  const [jurisdiction, setJurisdiction] = useState(ALL);
  const [facilityType, setFacilityType] = useState(ALL);
  const [risk, setRisk] = useState(ALL);
  const [assignee, setAssignee] = useState(ALL);

  useEffect(() => { syncApplications(); }, [syncApplications, applications]);

  const records = useMemo(() => cases.map((item) => ({ item, application: applications.find((application) => application.id === item.applicationId) })).filter((entry) => entry.application), [applications, cases]);
  const filtered = records.filter(({ item, application }) => {
    const haystack = `${application!.reference} ${application!.organization.legalName} ${application!.organization.tradingName}`.toLowerCase();
    return haystack.includes(query.toLowerCase())
      && (status === ALL || item.status === status)
      && (jurisdiction === ALL || `${application!.organization.state}, ${application!.organization.country}` === jurisdiction)
      && (facilityType === ALL || application!.organization.facilityType === facilityType)
      && (risk === ALL || item.risk === risk)
      && (assignee === ALL || (assignee === "UNASSIGNED" ? !item.assigneeId : item.assigneeId === assignee));
  });
  const selected = applicationId ? records.find((entry) => entry.item.applicationId === applicationId) : undefined;

  if (applicationId && !selected) return <div><CommandPageHeader eyebrow="Customers" title="Verification case unavailable" description="The application is not in this browser's submitted-application queue."/><Link to="/command-center/onboarding" className="text-sm font-bold text-emerald-700">Back to verification queue</Link></div>;
  if (selected) return <CaseDetail item={selected.item} application={selected.application!} canManage={canManage} canVerify={canVerify} />;

  const jurisdictionOptions = [...new Set(records.map(({ application }) => `${application!.organization.state}, ${application!.organization.country}`))];
  const facilityOptions = [...new Set(records.map(({ application }) => application!.organization.facilityType))];
  return <div>
    <CommandPageHeader eyebrow="Customers" title="Verification center" description="Review submitted organization applications and compliance evidence before approval. Approval never creates a tenant." actions={<span className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">{filtered.length} in queue</span>}/>
    {!canManage && <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldAlert size={18} className="shrink-0"/><span>Your role can view this queue{canVerify ? " and decide individual checks" : ""}, but case-management actions require <b>onboarding.manage</b>.</span></div>}
    <Panel className="mb-4 p-3"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
      <label className="relative md:col-span-2 xl:col-span-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><CommandInput className="w-full pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or reference"/></label>
      <CommandSelect value={status} onChange={(event) => setStatus(event.target.value)}><option value={ALL}>All statuses</option>{["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFORMATION", "APPROVED", "REJECTED"].map((item) => <option key={item}>{item}</option>)}</CommandSelect>
      <CommandSelect value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)}><option value={ALL}>All jurisdictions</option>{jurisdictionOptions.map((item) => <option key={item}>{item}</option>)}</CommandSelect>
      <CommandSelect value={facilityType} onChange={(event) => setFacilityType(event.target.value)}><option value={ALL}>All facility types</option>{facilityOptions.map((item) => <option key={item}>{item}</option>)}</CommandSelect>
      <CommandSelect value={risk} onChange={(event) => setRisk(event.target.value)}><option value={ALL}>All risk levels</option>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((item) => <option key={item}>{item}</option>)}</CommandSelect>
      <CommandSelect value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value={ALL}>All assignees</option><option value="UNASSIGNED">Unassigned</option>{platformUsers.filter((item) => hasPermission(item, "onboarding.manage")).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</CommandSelect>
    </div></Panel>
    <Panel><div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-slate-50"><th className="cc-th">Application</th><th className="cc-th">Facility</th><th className="cc-th">Jurisdiction</th><th className="cc-th">Risk</th><th className="cc-th">Assignee</th><th className="cc-th">Submitted</th><th className="cc-th">Status</th><th className="cc-th"></th></tr></thead><tbody>
      {filtered.map(({ item, application }) => <tr key={item.id} className="border-t border-slate-100"><td className="cc-td"><span className="block font-semibold text-slate-900">{application!.organization.tradingName || application!.organization.legalName}</span><span className="text-xs text-slate-400">{application!.reference}</span></td><td className="cc-td">{application!.organization.facilityType}</td><td className="cc-td">{application!.organization.state}, {application!.organization.country}</td><td className="cc-td"><RiskPill risk={item.risk}/></td><td className="cc-td">{platformUsers.find((user) => user.id === item.assigneeId)?.name ?? "Unassigned"}</td><td className="cc-td">{formatDate(application!.submittedAt)}</td><td className="cc-td"><StatusPill status={item.status.replaceAll("_", " ")}/></td><td className="cc-td"><CommandButton variant="quiet" onClick={() => navigate(`/command-center/onboarding/${application!.id}`)}>Review</CommandButton></td></tr>)}
      {filtered.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-sm text-slate-500">No submitted applications match these filters.</td></tr>}
    </tbody></table></div></Panel>
  </div>;
}

function CaseDetail({ item, application, canManage, canVerify }: { item: VerificationCase; application: OrganizationApplication; canManage: boolean; canVerify: boolean }) {
  const state = useVerificationCenter();
  const users = useCommandCenter((store) => store.platformUsers);
  const stagedDocuments = useComplianceUploads((store) => store.documents);
  const [message, setMessage] = useState("");
  const [checkReasons, setCheckReasons] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<"INTERNAL" | "APPLICANT">("INTERNAL");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestedItems, setRequestedItems] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const resolved = resolveComplianceRequirements(application);
  const blockers = getApprovalBlockers(application, item);
  const reviewerOptions = users.filter((user) => hasPermission(user, "onboarding.manage"));
  const run = (action: () => { ok: true } | { ok: false; error: string }, success: string) => {
    const result = action();
    setMessage(result.ok ? success : result.error);
    return result.ok;
  };

  return <div>
    <Link to="/command-center/onboarding" className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-emerald-700"><ArrowLeft size={14}/>Verification queue</Link>
    <CommandPageHeader eyebrow={application.reference} title={application.organization.tradingName || application.organization.legalName} description={`${application.organization.facilityType} · ${application.organization.state}, ${application.organization.country}`} actions={<><RiskPill risk={item.risk}/><StatusPill status={item.status.replaceAll("_", " ")}/></>}/>
    {message && <div role="status" className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${message.toLowerCase().includes("permission") || message.toLowerCase().includes("must") || message.toLowerCase().includes("provide") || message.toLowerCase().includes("cannot") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</div>}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-4">
        <Panel><PanelHeader title="Application evidence" description="Application data is reviewable; staged document bodies are not retained by this frontend prototype."/><div className="grid gap-3 p-4 md:grid-cols-2">
          <Evidence label="Legal organization"><b>{application.organization.legalName}</b><span>{application.corporate.registeredLegalName || "No registered name supplied"}</span><span>CAC / registration: {application.corporate.registrationNumber || "Missing"}</span></Evidence>
          <Evidence label="Facility registration"><b>{application.regulatoryRegistration.registrationNumber || "Missing"}</b><span>{application.regulatoryRegistration.facilityCategory || application.organization.facilityType}</span><span>Expires {application.regulatoryRegistration.expiryDate || "Not supplied"}</span></Evidence>
          <Evidence label="Operating officer"><b>{application.operatingOfficer.fullName || "Missing"}</b><span>{application.operatingOfficer.profession} · {application.operatingOfficer.registrationNumber || "No registration number"}</span><span>Licence expires {application.operatingOfficer.licenceExpiryDate || "Not supplied"}</span></Evidence>
          <Evidence label="Facility profile"><b>{application.facility.facilities} site(s) · {application.facility.beds} beds</b><span>{application.facility.staff} staff · {application.facility.monthlyPatients} monthly patients</span><span>{application.facility.services.join(", ") || "No services listed"}</span></Evidence>
        </div></Panel>

        <Panel><PanelHeader title="Verification checks" description={`${resolved.requirements.length} configured compliance requirements · reasons are mandatory and auditable`}/><div className="divide-y divide-slate-100">{item.checks.map((check) => <div key={check.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><p className="text-sm font-bold text-slate-900">{check.label}</p>{check.required && <span className="text-[10px] font-bold uppercase text-red-600">Required</span>}</div><p className="mt-1 text-xs text-slate-500">{check.kind.replace("_", " ")} · {check.evidenceAvailability === "SESSION_ONLY" ? "File body unavailable in this frontend prototype" : "Structured application data"}</p>{check.reason && <p className="mt-2 text-xs leading-5 text-slate-600">Last decision: {check.reason}</p>}</div><StatusPill status={check.status.replaceAll("_", " ")}/></div>
          {check.kind === "DOCUMENT" && check.requirementId && (() => { const evidence = stagedDocuments.find((document) => document.applicationId === application.id && document.requirementId === check.requirementId); return evidence ? <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800"><span className="truncate">Session evidence: {evidence.filename} · {(evidence.size / 1024 / 1024).toFixed(2)} MB</span><CommandButton variant="quiet" className="h-7 shrink-0" onClick={() => { const staged = getSessionComplianceFile(application.id, check.requirementId!); if (!staged) return setMessage("The evidence session has expired."); const url = URL.createObjectURL(staged.file); window.open(url, "_blank", "noopener,noreferrer"); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); }}>Open evidence</CommandButton></div> : <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">No secure evidence object is available in this session. Request a new upload before deciding this check.</p>; })()}
          {item.status === "UNDER_REVIEW" && <div className="mt-3 flex flex-wrap gap-2"><CommandInput className="min-w-[240px] flex-1" value={checkReasons[check.id] ?? ""} onChange={(event) => setCheckReasons((current) => ({ ...current, [check.id]: event.target.value }))} placeholder="Required review rationale"/><CommandButton disabled={!canVerify || (check.kind === "DOCUMENT" && !stagedDocuments.some((document) => document.applicationId === application.id && document.requirementId === check.requirementId))} onClick={() => run(() => state.decideCheck(application.id, check.id, "VERIFIED", checkReasons[check.id] ?? ""), `${check.label} verified.`)}><CheckCircle2 size={14}/>Verify</CommandButton><CommandButton disabled={!canVerify || (check.kind === "DOCUMENT" && !stagedDocuments.some((document) => document.applicationId === application.id && document.requirementId === check.requirementId))} variant="secondary" onClick={() => run(() => state.decideCheck(application.id, check.id, "FAILED", checkReasons[check.id] ?? ""), `${check.label} failed.`)}><XCircle size={14}/>Fail</CommandButton><CommandButton disabled={!canVerify || (check.kind === "DOCUMENT" && !stagedDocuments.some((document) => document.applicationId === application.id && document.requirementId === check.requirementId))} variant="quiet" onClick={() => run(() => state.decideCheck(application.id, check.id, "EXPIRED", checkReasons[check.id] ?? ""), `${check.label} marked expired.`)}><Clock3 size={14}/>Expired</CommandButton></div>}
        </div>)}</div></Panel>

        <Panel><PanelHeader title="Information requests" description="Only the request and applicant response are visible outside Command Center."/><div className="divide-y divide-slate-100">{item.informationRequests.map((request) => <div key={request.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{request.message}</p><p className="mt-1 text-xs text-slate-400">{request.requestedItems.join(", ") || "General clarification"} · {formatDate(request.requestedAt)}</p></div><StatusPill status={request.status}/></div>{request.responses.map((response) => <div key={response.id} className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><b className="block text-xs">Applicant response · {formatDate(response.createdAt)}</b><span className="mt-1 block">{response.body}</span></div>)}{request.status === "RESPONDED" && <CommandButton className="mt-3" disabled={!canManage} variant="secondary" onClick={() => run(() => state.resolveRequest(application.id, request.id), "Information request resolved.")}>Resolve request</CommandButton>}</div>)}{item.informationRequests.length === 0 && <p className="p-4 text-sm text-slate-500">No information has been requested.</p>}</div>
          {item.status === "UNDER_REVIEW" && <div className="space-y-2 border-t border-slate-100 p-4"><textarea className="min-h-20 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500" value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} placeholder="Applicant-visible request message"/><CommandInput className="w-full" value={requestedItems} onChange={(event) => setRequestedItems(event.target.value)} placeholder="Requested items, comma separated"/><CommandButton disabled={!canManage} onClick={() => { if (run(() => state.requestInformation(application.id, requestMessage, requestedItems.split(",").map((entry) => entry.trim())), "Information requested from applicant.")) { setRequestMessage(""); setRequestedItems(""); } }}><MessageSquareText size={14}/>Request information</CommandButton></div>}
        </Panel>

        <Panel><PanelHeader title="Review notes" description="Internal notes never appear on the applicant status page."/><div className="divide-y divide-slate-100">{item.notes.map((entry) => <div key={entry.id} className="p-4"><div className="flex items-center gap-2"><StatusPill status={entry.visibility}/><span className="text-xs text-slate-400">{entry.authorName} · {formatDate(entry.createdAt)}</span></div><p className="mt-2 text-sm leading-6 text-slate-700">{entry.body}</p></div>)}{item.notes.length === 0 && <p className="p-4 text-sm text-slate-500">No reviewer notes yet.</p>}</div><div className="flex flex-col gap-2 border-t border-slate-100 p-4 sm:flex-row"><CommandSelect value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}><option value="INTERNAL">Internal only</option><option value="APPLICANT">Applicant visible</option></CommandSelect><CommandInput className="flex-1" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a review note"/><CommandButton disabled={!canManage} onClick={() => { if (run(() => state.addNote(application.id, visibility, note), "Review note added.")) setNote(""); }}>Add note</CommandButton></div></Panel>
      </div>

      <aside className="space-y-4">
        <Panel><PanelHeader title="Case control"/><div className="space-y-4 p-4"><label className="block"><span className="cc-label">Assignee</span><CommandSelect disabled={!canManage} className="w-full" value={item.assigneeId ?? ""} onChange={(event) => run(() => state.setAssignee(application.id, event.target.value), "Assignee updated.")}><option value="" disabled>Unassigned</option>{reviewerOptions.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</CommandSelect></label>{item.status === "SUBMITTED" && <CommandButton className="w-full" disabled={!canManage} onClick={() => run(() => state.startReview(application.id), "Review started.")}><ClipboardCheck size={15}/>Start review</CommandButton>}<div className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600"><b className="block text-slate-800">Lifecycle boundary</b>Approval changes only the application and verification case. Organization, subscription and tenant states remain untouched.</div></div></Panel>
        <Panel><PanelHeader title="Risk signals"/><div className="space-y-2 p-4">{item.riskFlags.map((flag) => <div key={flag} className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900"><AlertTriangle size={14} className="mt-0.5 shrink-0"/>{flag}</div>)}{item.riskFlags.length === 0 && <div className="flex gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800"><BadgeCheck size={14}/>No automated risk hints detected.</div>}<p className="text-[10px] leading-4 text-slate-400">Signals assist reviewers; they never approve, reject or merge an application automatically.</p></div></Panel>
        <Panel><PanelHeader title="Final decision"/><div className="space-y-3 p-4"><textarea disabled={!canManage || ["APPROVED", "REJECTED"].includes(item.status)} className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50" value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} placeholder="Mandatory approval or rejection rationale"/>{blockers.length > 0 && item.status !== "REJECTED" && <div className="rounded-lg bg-amber-50 p-3"><p className="text-xs font-bold text-amber-900">Approval blocked</p><ul className="mt-2 space-y-1 text-xs leading-5 text-amber-800">{blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}</ul></div>}<div className="grid grid-cols-2 gap-2"><CommandButton disabled={!canManage || blockers.length > 0 || item.status !== "UNDER_REVIEW"} onClick={() => run(() => state.approve(application.id, decisionReason), "Application approved. No tenant was created.")}><UserRoundCheck size={14}/>Approve</CommandButton><CommandButton disabled={!canManage || !["UNDER_REVIEW", "NEEDS_INFORMATION"].includes(item.status)} variant="danger" onClick={() => run(() => state.reject(application.id, decisionReason), "Application rejected.")}><XCircle size={14}/>Reject</CommandButton></div></div></Panel>
        <Panel><PanelHeader title="Immutable case history"/><div className="max-h-[420px] space-y-4 overflow-y-auto p-4">{[...item.events].reverse().map((event) => <div key={event.id} className="relative border-l border-slate-200 pl-4"><span className="absolute -left-1 top-1 h-2 w-2 rounded-full bg-emerald-500"/><p className="text-xs font-bold text-slate-800">{event.action}</p><p className="mt-1 text-[10px] text-slate-400">{event.actorName} · {formatDate(event.timestamp)}</p>{event.reason && <p className="mt-1 text-xs leading-5 text-slate-600">{event.reason}</p>}</div>)}</div></Panel>
      </aside>
    </div>
  </div>;
}

function Evidence({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rounded-lg border border-slate-200 p-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><div className="space-y-1 text-xs text-slate-500 [&>b]:block [&>b]:text-sm [&>b]:text-slate-900 [&>span]:block">{children}</div></div>;
}

function RiskPill({ risk }: { risk: VerificationCase["risk"] }) {
  const style = risk === "LOW" ? "bg-emerald-50 text-emerald-700" : risk === "MEDIUM" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-extrabold ${style}`}><AlertTriangle size={11}/>{risk} RISK</span>;
}
