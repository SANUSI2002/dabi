import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Mail, Phone } from "lucide-react";
import { useSabiHealth } from "../../useSabiHealth";
import { useAuth } from "@/store/useAuth";
import { formatDate } from "../../format";
import { cn } from "@/lib/cn";
import {
  BackLink, CommandButton, CommandPageHeader, Field, Mini, NotFound, Panel, PanelHeader,
  ReasonDialog, StatusPill, Summary, type PendingAction,
} from "./shared";

const TABS = ["Overview", "Consultations & orders", "Audit"];

export default function PatientDetail() {
  const { patientId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = TABS.includes(searchParams.get("tab") ?? "") ? searchParams.get("tab")! : "Overview";
  const state = useSabiHealth();
  const actorId = useAuth((s) => s.identity?.platformUserId);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const patient = state.patients.find((item) => item.id === patientId);

  if (!patient) return <NotFound label="Patient not found" backTo="/command-center/sabi-health/patients" backLabel="Back to patients" />;

  const selectTab = (tab: string) => setSearchParams(tab === "Overview" ? {} : { tab });
  const consultations = state.consultations.filter((c) => c.patientId === patientId);
  const orders = state.medicationOrders.filter((o) => o.patientId === patientId);
  const auditEvents = state.auditEvents.filter((e) => e.resourceType === "Patient" && e.resourceId === patientId);

  const suspend = () => setPending({
    title: `Suspend ${patient.name}`,
    description: "This immediately blocks the patient from booking consultations or placing orders until restored.",
    confirm: "Suspend account", danger: true,
    onConfirm: (reason) => { const result = state.setPatientStatus(patientId, "Suspended", reason, actorId); if (!result.ok) throw new Error(result.error); },
  });
  const restore = () => setPending({
    title: `Restore ${patient.name}`,
    description: "This restores the patient's ability to book consultations and place orders.",
    confirm: "Restore account",
    onConfirm: (reason) => { const result = state.setPatientStatus(patientId, "Active", reason, actorId); if (!result.ok) throw new Error(result.error); },
  });

  return <div>
    <BackLink to="/command-center/sabi-health/patients" label="Patients" />
    <CommandPageHeader eyebrow={patient.sabiHealthId} title={patient.name} description={`${patient.country} · Joined ${formatDate(patient.joinedAt)}`} actions={<>
      <StatusPill status={patient.accountStatus} />
      {patient.accountStatus === "Suspended"
        ? <CommandButton variant="secondary" onClick={restore}>Restore account</CommandButton>
        : <CommandButton variant="danger" onClick={suspend}>Suspend account</CommandButton>}
    </>} />

    <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Summary label="Verification" value={patient.verificationStatus} status />
      <Summary label="Consultations" value={patient.consultationCount} />
      <Summary label="Active orders" value={patient.activeOrderCount} />
      <Summary label="Last activity" value={formatDate(patient.lastActivityAt)} />
    </div>

    <div className="mb-4 overflow-x-auto border-b border-slate-200 [scrollbar-width:none]"><div role="tablist" aria-label="Patient sections" className="flex min-w-max gap-1">{TABS.map((tab) => <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => selectTab(tab)} className={cn("border-b-2 px-3 py-2.5 text-xs font-semibold transition", activeTab === tab ? "border-emerald-500 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800")}>{tab}</button>)}</div></div>

    {activeTab === "Overview" && (
      <div className="grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
        <Panel><PanelHeader title="Account profile" description="Least-privilege view — full clinical records live only in the telemedicine app" /><div className="grid gap-x-8 gap-y-4 p-4 sm:grid-cols-2"><Field label="Patient ID" value={patient.sabiHealthId} /><Field label="Country" value={patient.country} /><Field label="Email" value={patient.email} icon={<Mail size={14} />} /><Field label="Phone" value={patient.phone} icon={<Phone size={14} />} /><Field label="Joined" value={formatDate(patient.joinedAt)} /><Field label="Last activity" value={formatDate(patient.lastActivityAt)} /></div></Panel>
        <Panel><PanelHeader title="Activity snapshot" /><div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:divide-y-0"><Mini label="Consultations" value={patient.consultationCount} /><Mini label="Active orders" value={patient.activeOrderCount} /></div></Panel>
      </div>
    )}
    {activeTab === "Consultations & orders" && (
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel><PanelHeader title="Consultations" /><div className="overflow-x-auto">{consultations.length === 0 ? <p className="p-4 text-sm text-slate-500">No consultations recorded.</p> : <table className="w-full"><thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="cc-th">Scheduled</th><th className="cc-th">Type</th><th className="cc-th">Status</th><th className="cc-th">Payment</th></tr></thead><tbody>{consultations.map((c) => <tr key={c.id} onClick={() => navigate(`/command-center/sabi-health/consultations/${c.id}`)} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-emerald-50/35"><td className="cc-td">{formatDate(c.scheduledFor)}</td><td className="cc-td">{c.type}</td><td className="cc-td"><StatusPill status={c.status.replaceAll("_", " ")} /></td><td className="cc-td"><StatusPill status={c.paymentStatus} /></td></tr>)}</tbody></table>}</div></Panel>
        <Panel><PanelHeader title="Medication orders" /><div className="overflow-x-auto">{orders.length === 0 ? <p className="p-4 text-sm text-slate-500">No medication orders recorded.</p> : <table className="w-full"><thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="cc-th">Order</th><th className="cc-th">Status</th><th className="cc-th">Total</th></tr></thead><tbody>{orders.map((o) => <tr key={o.id} className="border-b border-slate-100 last:border-0"><td className="cc-td font-mono text-xs">{o.id}</td><td className="cc-td"><StatusPill status={o.status.replaceAll("_", " ")} /></td><td className="cc-td">{o.currency} {o.total.toLocaleString()}</td></tr>)}</tbody></table>}</div></Panel>
      </div>
    )}
    {activeTab === "Audit" && (
      <Panel><PanelHeader title="Audit log" description="Every Command Center action taken on this patient account" /><div className="divide-y divide-slate-100">{auditEvents.length === 0 ? <p className="p-4 text-sm text-slate-500">No Command Center actions recorded for this patient yet.</p> : auditEvents.map((event) => <div key={event.id} className="px-4 py-3"><p className="text-sm font-semibold text-slate-800">{event.action}</p>{event.reason && <p className="mt-0.5 text-xs text-slate-500">{event.reason}</p>}<p className="mt-0.5 text-xs text-slate-400">{event.actorName} · {formatDate(event.timestamp)}</p></div>)}</div></Panel>
    )}

    <ReasonDialog pending={pending} onClose={() => setPending(null)} />
  </div>;
}
