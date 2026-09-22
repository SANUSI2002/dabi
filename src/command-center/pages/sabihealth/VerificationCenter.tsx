import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle, BadgeCheck, CheckCircle2, Clock3, FlaskConical, Pill,
  Search, ShieldAlert, Stethoscope, UserRoundCheck, XCircle,
} from "lucide-react";
import { useSabiHealth, getVerificationBlockers } from "../../useSabiHealth";
import { useCommandCenter } from "../../useCommandCenter";
import { hasPermission } from "../../access";
import { useAuth } from "@/store/useAuth";
import { formatDate } from "../../format";
import { DOCUMENT_LABELS, REQUIRED_DOCUMENTS, type VerificationDocumentStatus, type VerificationSubjectType } from "../../sabihealth/domain";
import { BackLink, CommandButton, CommandInput, CommandPageHeader, CommandSelect, NotFound, Panel, PanelHeader, StatusPill } from "./shared";

const ALL = "ALL";
const QUEUE_ICON: Record<VerificationSubjectType, typeof Stethoscope> = { Doctor: Stethoscope, Pharmacy: Pill, Laboratory: FlaskConical };

function isInQueue(subjectType: VerificationSubjectType, status: string) {
  return subjectType === "Doctor"
    ? status === "APPLICATION_STARTED" || status === "APPLICATION_SUBMITTED" || status === "UNDER_REVIEW"
    : status === "APPLICATION" || status === "PENDING_VERIFICATION";
}

export default function SabiHealthVerificationCenter() {
  const { subjectId } = useParams();
  return subjectId ? <CaseDetail subjectId={subjectId} /> : <Queue />;
}

function Queue() {
  const state = useSabiHealth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [type, setType] = useState(ALL);

  const rows = useMemo(() => [
    ...state.doctors.filter((d) => isInQueue("Doctor", d.status)).map((d) => ({ id: d.id, type: "Doctor" as const, name: d.name, detail: `${d.specialty} · ${d.city}, ${d.country}`, status: d.status, submittedAt: d.joinedAt })),
    ...state.pharmacies.filter((p) => isInQueue("Pharmacy", p.status)).map((p) => ({ id: p.id, type: "Pharmacy" as const, name: p.businessName, detail: `${p.city}, ${p.country}`, status: p.status, submittedAt: p.joinedAt })),
    ...state.laboratories.filter((l) => isInQueue("Laboratory", l.status)).map((l) => ({ id: l.id, type: "Laboratory" as const, name: l.name, detail: `${l.city}, ${l.country}`, status: l.status, submittedAt: l.joinedAt })),
  ], [state.doctors, state.laboratories, state.pharmacies]);

  const filtered = rows.filter((row) => (type === ALL || row.type === type) && (!query || `${row.name} ${row.detail}`.toLowerCase().includes(query.toLowerCase())));

  return <div>
    <CommandPageHeader eyebrow="Sabi Health" title="Verification center" description="Review doctor, pharmacy and laboratory applications and their document evidence before approval." actions={<span className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">{filtered.length} in queue</span>} />
    <Panel className="mb-4 p-3"><div className="grid gap-2 md:grid-cols-2">
      <label className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><CommandInput className="w-full pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or location" /></label>
      <CommandSelect value={type} onChange={(event) => setType(event.target.value)}><option value={ALL}>All types</option><option value="Doctor">Doctors</option><option value="Pharmacy">Pharmacies</option><option value="Laboratory">Laboratories</option></CommandSelect>
    </div></Panel>
    <Panel><div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-slate-50"><th className="cc-th">Applicant</th><th className="cc-th">Type</th><th className="cc-th">Documents</th><th className="cc-th">Submitted</th><th className="cc-th">Status</th><th className="cc-th"></th></tr></thead><tbody>
      {filtered.map((row) => {
        const documents = state.verificationDocuments.filter((doc) => doc.subjectType === row.type && doc.subjectId === row.id);
        const verified = documents.filter((doc) => doc.status === "VERIFIED").length;
        const Icon = QUEUE_ICON[row.type];
        return <tr key={row.id} className="cursor-pointer border-t border-slate-100 hover:bg-emerald-50/35" onClick={() => navigate(`/command-center/sabi-health/verification/${row.id}`)}>
          <td className="cc-td"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><Icon size={15} /></span><span><span className="block font-semibold text-slate-900">{row.name}</span><span className="block text-xs text-slate-400">{row.detail}</span></span></div></td>
          <td className="cc-td">{row.type}</td>
          <td className="cc-td">{verified} / {documents.length} verified</td>
          <td className="cc-td">{formatDate(row.submittedAt)}</td>
          <td className="cc-td"><StatusPill status={row.status.replaceAll("_", " ")} /></td>
          <td className="cc-td"><CommandButton variant="quiet">Review</CommandButton></td>
        </tr>;
      })}
      {filtered.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-sm text-slate-500">No applications match these filters.</td></tr>}
    </tbody></table></div></Panel>
  </div>;
}

const SUBJECT_LABEL: Record<VerificationSubjectType, string> = { Doctor: "doctor", Pharmacy: "pharmacy", Laboratory: "laboratory" };

function CaseDetail({ subjectId }: { subjectId: string }) {
  const state = useSabiHealth();
  const platformUsers = useCommandCenter((s) => s.platformUsers);
  const identity = useAuth((s) => s.identity);
  const actor = platformUsers.find((item) => item.id === identity?.platformUserId);
  const canVerify = hasPermission(actor, "sabihealth.verification.decide");
  const [message, setMessage] = useState("");
  const [docReasons, setDocReasons] = useState<Record<string, string>>({});
  const [decisionReason, setDecisionReason] = useState("");

  const doctor = state.doctors.find((d) => d.id === subjectId);
  const pharmacy = state.pharmacies.find((p) => p.id === subjectId);
  const laboratory = state.laboratories.find((l) => l.id === subjectId);
  const subjectType: VerificationSubjectType | undefined = doctor ? "Doctor" : pharmacy ? "Pharmacy" : laboratory ? "Laboratory" : undefined;
  const name = doctor?.name ?? pharmacy?.businessName ?? laboratory?.name;
  const status = doctor?.status ?? pharmacy?.status ?? laboratory?.status;

  if (!subjectType || !name || !status) return <NotFound label="Verification case not found" backTo="/command-center/sabi-health/verification" backLabel="Back to verification queue" />;

  const documents = REQUIRED_DOCUMENTS[subjectType].map((documentType) => state.verificationDocuments.find((doc) => doc.subjectType === subjectType && doc.subjectId === subjectId && doc.documentType === documentType));
  const blockers = getVerificationBlockers(state.verificationDocuments, subjectType, subjectId);
  const auditEvents = state.auditEvents.filter((e) => e.resourceType === subjectType && e.resourceId === subjectId);

  const run = (action: () => { ok: true; id: string } | { ok: false; error: string }, success: string) => {
    const result = action();
    setMessage(result.ok ? success : result.error);
    return result.ok;
  };

  const decide = (documentId: string, next: VerificationDocumentStatus) => run(() => state.decideDocument(documentId, next, docReasons[documentId] ?? "", actor?.id), "Document decision recorded.");

  const approve = () => run(() => (subjectType === "Doctor" ? state.setDoctorStatus(subjectId, "VERIFIED", decisionReason, actor?.id) : subjectType === "Pharmacy" ? state.setPharmacyStatus(subjectId, "VERIFIED", decisionReason, actor?.id) : state.setLaboratoryStatus(subjectId, "VERIFIED", decisionReason, actor?.id)), `${name} approved — still needs to be activated to go live.`);
  const reject = () => run(() => (subjectType === "Doctor" ? state.setDoctorStatus(subjectId, "REJECTED", decisionReason, actor?.id) : subjectType === "Pharmacy" ? state.setPharmacyStatus(subjectId, "REJECTED", decisionReason, actor?.id) : state.setLaboratoryStatus(subjectId, "REJECTED", decisionReason, actor?.id)), `${name}'s application rejected.`);

  const resolved = !isInQueue(subjectType, status);

  return <div>
    <BackLink to="/command-center/sabi-health/verification" label="Verification queue" />
    <CommandPageHeader eyebrow={`${subjectType} application`} title={name} description={`Reviewing ${SUBJECT_LABEL[subjectType]} credentials before network approval`} actions={<StatusPill status={status.replaceAll("_", " ")} />} />
    {message && <div role="status" className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${message.toLowerCase().includes("cannot") || message.toLowerCase().includes("permission") || message.toLowerCase().includes("not found") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</div>}
    {!canVerify && <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldAlert size={18} className="shrink-0" /><span>Your role can view this case, but deciding documents or the final verdict requires <b>sabihealth.verification.decide</b>.</span></div>}

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Panel><PanelHeader title="Document checklist" description="Document bodies are not retained by this frontend — no file backend exists yet. Reviewers record a structured decision only." /><div className="divide-y divide-slate-100">
          {documents.map((document, index) => {
            const documentType = REQUIRED_DOCUMENTS[subjectType][index];
            if (!document) return <div key={documentType} className="p-4 text-sm text-slate-500">{DOCUMENT_LABELS[documentType]} — not yet submitted by the applicant.</div>;
            return <div key={document.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-sm font-bold text-slate-900">{DOCUMENT_LABELS[document.documentType]}</p>{document.reason && <p className="mt-1 text-xs leading-5 text-slate-600">Last decision: {document.reason}</p>}{document.reviewedAt && <p className="mt-1 text-[11px] text-slate-400">Reviewed {formatDate(document.reviewedAt)}</p>}</div>
                <StatusPill status={document.status} />
              </div>
              {!resolved && <div className="mt-3 flex flex-wrap gap-2">
                <CommandInput className="min-w-[220px] flex-1" value={docReasons[document.id] ?? ""} onChange={(event) => setDocReasons((current) => ({ ...current, [document.id]: event.target.value }))} placeholder="Review rationale" />
                <CommandButton disabled={!canVerify} onClick={() => decide(document.id, "VERIFIED")}><CheckCircle2 size={14} />Verify</CommandButton>
                <CommandButton disabled={!canVerify} variant="secondary" onClick={() => decide(document.id, "REJECTED")}><XCircle size={14} />Reject</CommandButton>
                <CommandButton disabled={!canVerify} variant="quiet" onClick={() => decide(document.id, "EXPIRED")}><Clock3 size={14} />Expired</CommandButton>
              </div>}
            </div>;
          })}
        </div></Panel>
      </div>

      <aside className="space-y-4">
        <Panel><PanelHeader title="Outstanding items" /><div className="space-y-2 p-4">
          {blockers.length === 0
            ? <div className="flex gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800"><BadgeCheck size={14} className="mt-0.5 shrink-0" />All required documents are verified.</div>
            : blockers.map((blocker) => <div key={blocker} className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{blocker}</div>)}
        </div></Panel>

        <Panel><PanelHeader title="Final decision" /><div className="space-y-3 p-4">
          <textarea disabled={!canVerify || resolved} className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50" value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} placeholder="Mandatory approval or rejection rationale" />
          {resolved && <p className="text-xs text-slate-500">This case has already been decided — see the audit trail below.</p>}
          <div className="grid grid-cols-2 gap-2">
            <CommandButton disabled={!canVerify || resolved || blockers.length > 0} onClick={approve}><UserRoundCheck size={14} />Approve</CommandButton>
            <CommandButton disabled={!canVerify || resolved} variant="danger" onClick={reject}><XCircle size={14} />Reject</CommandButton>
          </div>
        </div></Panel>

        <Panel><PanelHeader title="Case history" /><div className="max-h-[360px] space-y-4 overflow-y-auto p-4">
          {auditEvents.length === 0 ? <p className="text-sm text-slate-500">No decisions recorded yet.</p> : auditEvents.map((event) => <div key={event.id} className="relative border-l border-slate-200 pl-4"><span className="absolute -left-1 top-1 h-2 w-2 rounded-full bg-emerald-500" /><p className="text-xs font-bold text-slate-800">{event.action}</p><p className="mt-1 text-[10px] text-slate-400">{event.actorName} · {formatDate(event.timestamp)}</p>{event.reason && <p className="mt-1 text-xs leading-5 text-slate-600">{event.reason}</p>}</div>)}
        </div></Panel>
      </aside>
    </div>
  </div>;
}
