import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import { useSabiHealth, getVerificationBlockers } from "../../useSabiHealth";
import { useAuth } from "@/store/useAuth";
import { formatDate } from "../../format";
import { cn } from "@/lib/cn";
import type { DoctorApplicationStatus } from "../../sabihealth/domain";
import {
  BackLink, CommandButton, CommandPageHeader, Field, Mini, NotFound, Panel, PanelHeader,
  ReasonDialog, StatusPill, Summary, type PendingAction,
} from "./shared";

const TABS = ["Overview", "Verification", "Consultations", "Audit"];

export default function DoctorDetail() {
  const { doctorId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = TABS.includes(searchParams.get("tab") ?? "") ? searchParams.get("tab")! : "Overview";
  const state = useSabiHealth();
  const actorId = useAuth((s) => s.identity?.platformUserId);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const doctor = state.doctors.find((item) => item.id === doctorId);

  if (!doctor) return <NotFound label="Doctor not found" backTo="/command-center/sabi-health/doctors" backLabel="Back to doctors" />;

  const selectTab = (tab: string) => setSearchParams(tab === "Overview" ? {} : { tab });
  const consultations = state.consultations.filter((c) => c.doctorId === doctorId);
  const auditEvents = state.auditEvents.filter((e) => e.resourceType === "Doctor" && e.resourceId === doctorId);

  const transition = (status: DoctorApplicationStatus, description: string, danger = false) => setPending({
    title: `Set ${doctor.name} to ${status.replaceAll("_", " ")}`,
    description,
    confirm: status.replaceAll("_", " "),
    danger,
    onConfirm: (reason) => { const result = state.setDoctorStatus(doctorId, status, reason, actorId); if (!result.ok) throw new Error(result.error); },
  });

  return <div>
    <BackLink to="/command-center/sabi-health/doctors" label="Doctors" />
    <CommandPageHeader eyebrow={doctor.specialty} title={doctor.name} description={`${doctor.city}, ${doctor.country} · Reg. ${doctor.medicalRegistrationNumber} · Joined ${formatDate(doctor.joinedAt)}`} actions={<>
      <StatusPill status={doctor.status.replaceAll("_", " ")} />
      {(doctor.status === "APPLICATION_STARTED" || doctor.status === "APPLICATION_SUBMITTED" || doctor.status === "UNDER_REVIEW") && (
        <CommandButton onClick={() => navigate(`/command-center/sabi-health/verification/${doctorId}`)}><ClipboardCheck size={15} />Review verification case</CommandButton>
      )}
      {doctor.status === "VERIFIED" && <CommandButton onClick={() => transition("ACTIVE", "Activates the doctor to accept consultations on the network.")}>Activate</CommandButton>}
      {doctor.status === "ACTIVE" && <CommandButton variant="danger" onClick={() => transition("SUSPENDED", "Immediately removes the doctor from availability and blocks new consultations.", true)}>Suspend</CommandButton>}
      {doctor.status === "SUSPENDED" && <CommandButton variant="secondary" onClick={() => transition("ACTIVE", "Restores the doctor to active availability on the network.")}>Restore</CommandButton>}
    </>} />

    <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Summary label="Employment" value={doctor.employmentType.replaceAll("_", " ")} />
      <Summary label="Completed consultations" value={doctor.completedConsultations} />
      <Summary label="License expiry" value={formatDate(doctor.licenseExpiresAt)} />
      <Summary label="Last activity" value={formatDate(doctor.lastActivityAt)} />
    </div>

    <div className="mb-4 overflow-x-auto border-b border-slate-200 [scrollbar-width:none]"><div role="tablist" aria-label="Doctor sections" className="flex min-w-max gap-1">{TABS.map((tab) => <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => selectTab(tab)} className={cn("border-b-2 px-3 py-2.5 text-xs font-semibold transition", activeTab === tab ? "border-emerald-500 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800")}>{tab}</button>)}</div></div>

    {activeTab === "Overview" && (
      <div className="grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
        <Panel><PanelHeader title="Doctor profile" /><div className="grid gap-x-8 gap-y-4 p-4 sm:grid-cols-2"><Field label="Specialty" value={doctor.specialty} /><Field label="Medical registration" value={doctor.medicalRegistrationNumber} /><Field label="Location" value={`${doctor.city}, ${doctor.country}`} /><Field label="Employment type" value={doctor.employmentType.replaceAll("_", " ")} /><Field label="Joined" value={formatDate(doctor.joinedAt)} /><Field label="License expiry" value={formatDate(doctor.licenseExpiresAt)} /></div></Panel>
        <Panel><PanelHeader title="Consultation volume" /><div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:divide-y-0"><Mini label="Completed" value={doctor.completedConsultations} /><Mini label="On record" value={consultations.length} /></div></Panel>
      </div>
    )}
    {activeTab === "Verification" && (() => {
      const documents = state.verificationDocuments.filter((doc) => doc.subjectType === "Doctor" && doc.subjectId === doctorId);
      const blockers = getVerificationBlockers(state.verificationDocuments, "Doctor", doctorId);
      return <Panel><PanelHeader title="Verification status" description="Document-backed review — open the verification case to decide individual documents" action={<CommandButton variant="secondary" onClick={() => navigate(`/command-center/sabi-health/verification/${doctorId}`)}><ClipboardCheck size={14} />Open case</CommandButton>} />
        <div className="grid gap-x-8 gap-y-4 p-4 sm:grid-cols-2"><Field label="Current status" value={<StatusPill status={doctor.status.replaceAll("_", " ")} />} /><Field label="Documents verified" value={`${documents.filter((d) => d.status === "VERIFIED").length} / ${documents.length}`} /><Field label="Medical registration number" value={doctor.medicalRegistrationNumber} /><Field label="License expiry" value={formatDate(doctor.licenseExpiresAt)} /><Field label="Organization link" value={doctor.organizationId ?? "Independent — not affiliated with a Sabi OS organization"} /></div>
        {blockers.length > 0 && <div className="border-t border-slate-100 p-4"><p className="mb-2 text-xs font-bold text-amber-800">Outstanding before approval</p><ul className="space-y-1 text-xs leading-5 text-amber-800">{blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}</ul></div>}
      </Panel>;
    })()}
    {activeTab === "Consultations" && (
      <Panel><PanelHeader title="Consultations" /><div className="overflow-x-auto">{consultations.length === 0 ? <p className="p-4 text-sm text-slate-500">No consultations recorded.</p> : <table className="w-full"><thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="cc-th">Scheduled</th><th className="cc-th">Type</th><th className="cc-th">Status</th><th className="cc-th">Payment</th><th className="cc-th">Prescription issued</th></tr></thead><tbody>{consultations.map((c) => <tr key={c.id} onClick={() => navigate(`/command-center/sabi-health/consultations/${c.id}`)} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-emerald-50/35"><td className="cc-td">{formatDate(c.scheduledFor)}</td><td className="cc-td">{c.type}</td><td className="cc-td"><StatusPill status={c.status.replaceAll("_", " ")} /></td><td className="cc-td"><StatusPill status={c.paymentStatus} /></td><td className="cc-td">{c.prescriptionIssued ? "Yes" : "No"}</td></tr>)}</tbody></table>}</div></Panel>
    )}
    {activeTab === "Audit" && (
      <Panel><PanelHeader title="Audit log" description="Every Command Center action taken on this doctor's account" /><div className="divide-y divide-slate-100">{auditEvents.length === 0 ? <p className="p-4 text-sm text-slate-500">No Command Center actions recorded for this doctor yet.</p> : auditEvents.map((event) => <div key={event.id} className="px-4 py-3"><p className="text-sm font-semibold text-slate-800">{event.action}</p>{event.reason && <p className="mt-0.5 text-xs text-slate-500">{event.reason}</p>}<p className="mt-0.5 text-xs text-slate-400">{event.actorName} · {formatDate(event.timestamp)}</p></div>)}</div></Panel>
    )}

    <ReasonDialog pending={pending} onClose={() => setPending(null)} />
  </div>;
}
