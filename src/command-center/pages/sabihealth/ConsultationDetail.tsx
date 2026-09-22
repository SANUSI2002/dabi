import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, BadgeCheck, ShieldAlert } from "lucide-react";
import { useSabiHealth, consultationNeedsAttention } from "../../useSabiHealth";
import { useCommandCenter } from "../../useCommandCenter";
import { hasPermission } from "../../access";
import { useAuth } from "@/store/useAuth";
import { formatDate } from "../../format";
import {
  BackLink, CommandButton, CommandPageHeader, Field, NotFound, Panel, PanelHeader,
  ReasonDialog, StatusPill, Summary, type PendingAction,
} from "./shared";

export default function ConsultationDetail() {
  const { consultationId = "" } = useParams();
  const navigate = useNavigate();
  const state = useSabiHealth();
  const platformUsers = useCommandCenter((s) => s.platformUsers);
  const identity = useAuth((s) => s.identity);
  const actor = platformUsers.find((item) => item.id === identity?.platformUserId);
  const canManage = hasPermission(actor, "sabihealth.operations.manage");
  const canBill = hasPermission(actor, "sabihealth.billing.manage");
  const [pending, setPending] = useState<PendingAction | null>(null);

  const consultation = state.consultations.find((item) => item.id === consultationId);
  if (!consultation) return <NotFound label="Consultation not found" backTo="/command-center/sabi-health/consultations" backLabel="Back to consultations" />;

  const patient = state.patients.find((p) => p.id === consultation.patientId);
  const doctor = state.doctors.find((d) => d.id === consultation.doctorId);
  const auditEvents = state.auditEvents.filter((e) => e.resourceType === "Consultation" && e.resourceId === consultationId);
  const attention = consultationNeedsAttention(consultation);
  const stuck = ["REQUESTED", "SCHEDULED", "WAITING"].includes(consultation.status);

  const promptCancel = () => setPending({
    title: "Cancel this consultation",
    description: "Marks the booking as cancelled. The patient and doctor calendars are managed by the telemedicine app once connected — this only updates Command Center's own record.",
    confirm: "Cancel consultation", danger: true,
    onConfirm: (reason) => { const result = state.cancelConsultation(consultationId, reason, actor?.id); if (!result.ok) throw new Error(result.error); },
  });
  const promptFlag = () => setPending({
    title: "Flag for refund review",
    description: "Sends this case to the payments team for review. This does not process a refund — no payment gateway is connected yet.",
    confirm: "Flag for refund review",
    onConfirm: (reason) => { const result = state.flagConsultationForRefund(consultationId, reason, actor?.id); if (!result.ok) throw new Error(result.error); },
  });
  const promptResolve = () => setPending({
    title: "Mark as reviewed",
    description: "Closes this case out of the operations queue with no refund action needed.",
    confirm: "Mark reviewed",
    onConfirm: (note) => { const result = state.markConsultationReviewed(consultationId, note, actor?.id); if (!result.ok) throw new Error(result.error); },
  });
  const promptRecordRefund = () => setPending({
    title: "Record refund as processed",
    description: "No payment gateway is connected — this only logs that the refund was completed manually through the payment processor's own dashboard. The reference below becomes part of the permanent audit trail.",
    confirm: "Record refund processed",
    onConfirm: (externalReference) => { const result = state.recordConsultationRefund(consultationId, externalReference, actor?.id); if (!result.ok) throw new Error(result.error); },
  });

  return <div>
    <BackLink to="/command-center/sabi-health/consultations" label="Telemedicine operations" />
    <CommandPageHeader eyebrow={consultation.type} title={`${patient?.name ?? "Unknown patient"} · ${doctor?.name ?? "Unknown doctor"}`} description={`Scheduled ${formatDate(consultation.scheduledFor)}`} actions={<>
      <StatusPill status={consultation.status.replaceAll("_", " ")} />
      <StatusPill status={consultation.paymentStatus} />
    </>} />
    {!canManage && <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldAlert size={18} className="shrink-0" /><span>Your role can view this case, but operational actions require <b>sabihealth.operations.manage</b>.</span></div>}

    {consultation.refundFlagged && consultation.paymentStatus !== "REFUNDED" && <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span><b className="block">Flagged for refund review</b>{consultation.refundFlagReason} — awaiting the payments team. No refund has been processed; payment processing is not connected yet.</span></div>}
    {consultation.paymentStatus === "REFUNDED" && consultation.refundFlagged && <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><BadgeCheck size={16} className="mt-0.5 shrink-0" /><span><b className="block">Refund recorded</b>Processed externally — see case history for the reference.</span></div>}
    {consultation.reviewedAt && <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><BadgeCheck size={16} className="mt-0.5 shrink-0" /><span><b className="block">Reviewed {formatDate(consultation.reviewedAt)}</b>{consultation.reviewNote}</span></div>}

    <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Summary label="Patient" value={patient ? <button className="text-emerald-700 underline" onClick={() => navigate(`/command-center/sabi-health/patients/${patient.id}`)}>{patient.name}</button> : "Unknown"} />
      <Summary label="Doctor" value={doctor ? <button className="text-emerald-700 underline" onClick={() => navigate(`/command-center/sabi-health/doctors/${doctor.id}`)}>{doctor.name}</button> : "Unknown"} />
      <Summary label="Prescription issued" value={consultation.prescriptionIssued ? "Yes" : "No"} />
      <Summary label="Needs attention" value={attention ? "Yes" : "No"} />
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
      <div className="space-y-4">
        <Panel><PanelHeader title="Timeline" /><div className="grid gap-x-8 gap-y-4 p-4 sm:grid-cols-2"><Field label="Scheduled for" value={formatDate(consultation.scheduledFor)} /><Field label="Started" value={formatDate(consultation.startedAt)} /><Field label="Completed" value={formatDate(consultation.completedAt)} /><Field label="Channel" value={consultation.type} /></div></Panel>

        {consultation.refundFlagged && consultation.paymentStatus !== "REFUNDED" ? (
          <Panel><PanelHeader title="Awaiting refund" description="This case is now finance's to close — record the refund once it's processed externally" /><div className="flex flex-wrap gap-2 p-4">
            <CommandButton disabled={!canBill} onClick={promptRecordRefund}>Record refund processed</CommandButton>
          </div>{!canBill && <p className="px-4 pb-4 text-xs text-slate-500">Requires <b>sabihealth.billing.manage</b>.</p>}</Panel>
        ) : canManage && !consultation.reviewedAt && (consultation.status === "TECHNICAL_FAILURE" || consultation.status === "DISPUTED" || (stuck && attention)) && (
          <Panel><PanelHeader title="Resolve this case" description="Choose the outcome — refunds are only flagged here, never processed" /><div className="flex flex-wrap gap-2 p-4">
            {stuck && <CommandButton variant="danger" onClick={promptCancel}>Cancel consultation</CommandButton>}
            <CommandButton variant="secondary" onClick={promptFlag}>Flag for refund review</CommandButton>
            <CommandButton onClick={promptResolve}>Mark reviewed — no refund needed</CommandButton>
          </div></Panel>
        )}

        <Panel><PanelHeader title="Case history" /><div className="divide-y divide-slate-100">{auditEvents.length === 0 ? <p className="p-4 text-sm text-slate-500">No operational decisions recorded yet.</p> : auditEvents.map((event) => <div key={event.id} className="px-4 py-3"><p className="text-sm font-semibold text-slate-800">{event.action}</p>{event.reason && <p className="mt-0.5 text-xs text-slate-500">{event.reason}</p>}<p className="mt-0.5 text-xs text-slate-400">{event.actorName} · {formatDate(event.timestamp)}</p></div>)}</div></Panel>
      </div>
    </div>

    <ReasonDialog pending={pending} onClose={() => setPending(null)} />
  </div>;
}
