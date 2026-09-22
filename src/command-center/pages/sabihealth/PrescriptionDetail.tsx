import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useSabiHealth, prescriptionNeedsAttention } from "../../useSabiHealth";
import { useCommandCenter } from "../../useCommandCenter";
import { hasPermission } from "../../access";
import { useAuth } from "@/store/useAuth";
import { formatDate } from "../../format";
import {
  BackLink, CommandButton, CommandPageHeader, Field, NotFound, Panel, PanelHeader,
  ReasonDialog, StatusPill, Summary, type PendingAction,
} from "./shared";

export default function PrescriptionDetail() {
  const { prescriptionId = "" } = useParams();
  const navigate = useNavigate();
  const state = useSabiHealth();
  const platformUsers = useCommandCenter((s) => s.platformUsers);
  const identity = useAuth((s) => s.identity);
  const actor = platformUsers.find((item) => item.id === identity?.platformUserId);
  const canManage = hasPermission(actor, "sabihealth.operations.manage");
  const [pending, setPending] = useState<PendingAction | null>(null);

  const prescription = state.prescriptions.find((item) => item.id === prescriptionId);
  if (!prescription) return <NotFound label="Prescription not found" backTo="/command-center/sabi-health/prescriptions" backLabel="Back to prescriptions" />;

  const patient = state.patients.find((p) => p.id === prescription.patientId);
  const doctor = state.doctors.find((d) => d.id === prescription.doctorId);
  const orders = state.medicationOrders.filter((o) => o.prescriptionId === prescriptionId);
  const auditEvents = state.auditEvents.filter((e) => e.resourceType === "Prescription" && e.resourceId === prescriptionId);
  const attention = prescriptionNeedsAttention(prescription, state.medicationOrders);
  const open = prescription.status === "ACTIVE" || prescription.status === "PARTIALLY_FILLED";

  const promptClose = (status: "EXPIRED" | "CANCELLED") => setPending({
    title: `Set prescription to ${status}`,
    description: "Closes out a prescription nobody ever filled. This only updates Command Center's own record — it does not notify the patient.",
    confirm: status === "EXPIRED" ? "Mark expired" : "Cancel prescription",
    danger: status === "CANCELLED",
    onConfirm: (reason) => { const result = state.setPrescriptionStatus(prescriptionId, status, reason, actor?.id); if (!result.ok) throw new Error(result.error); },
  });

  return <div>
    <BackLink to="/command-center/sabi-health/prescriptions" label="Prescriptions" />
    <CommandPageHeader eyebrow={doctor?.name ?? "Unknown doctor"} title={patient?.name ?? "Unknown patient"} description={`Issued ${formatDate(prescription.issuedAt)} · ${prescription.medicationCount} medication${prescription.medicationCount === 1 ? "" : "s"}`} actions={<>
      <StatusPill status={prescription.status.replaceAll("_", " ")} />
      {canManage && open && <>
        <CommandButton variant="secondary" onClick={() => promptClose("EXPIRED")}>Mark expired</CommandButton>
        <CommandButton variant="danger" onClick={() => promptClose("CANCELLED")}>Cancel</CommandButton>
      </>}
    </>} />
    {!canManage && <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldAlert size={18} className="shrink-0" /><span>Your role can view this case, but closing out a stale prescription requires <b>sabihealth.operations.manage</b>.</span></div>}
    {attention && open && <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><ShieldAlert size={16} className="mt-0.5 shrink-0" /><span>Issued over two weeks ago with no completed order — likely abandoned. Consider marking it expired.</span></div>}

    <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Summary label="Patient" value={patient ? <button className="text-emerald-700 underline" onClick={() => navigate(`/command-center/sabi-health/patients/${patient.id}`)}>{patient.name}</button> : "Unknown"} />
      <Summary label="Doctor" value={doctor ? <button className="text-emerald-700 underline" onClick={() => navigate(`/command-center/sabi-health/doctors/${doctor.id}`)}>{doctor.name}</button> : "Unknown"} />
      <Summary label="Quotations requested" value={prescription.quotationsRequested} />
      <Summary label="Orders" value={orders.length} />
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
      <div className="space-y-4">
        <Panel><PanelHeader title="Prescription details" /><div className="grid gap-x-8 gap-y-4 p-4 sm:grid-cols-2"><Field label="Issued" value={formatDate(prescription.issuedAt)} /><Field label="Medications" value={prescription.medicationCount} /><Field label="Quotations requested" value={prescription.quotationsRequested} /><Field label="Linked consultation" value={prescription.consultationId ? <button className="text-emerald-700 underline" onClick={() => navigate(`/command-center/sabi-health/consultations/${prescription.consultationId}`)}>{prescription.consultationId}</button> : "Not linked"} /></div></Panel>

        <Panel><PanelHeader title="Medication orders" /><div className="overflow-x-auto">{orders.length === 0 ? <p className="p-4 text-sm text-slate-500">No orders placed against this prescription yet.</p> : <table className="w-full"><thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="cc-th">Order</th><th className="cc-th">Status</th><th className="cc-th">Total</th></tr></thead><tbody>{orders.map((o) => <tr key={o.id} onClick={() => navigate(`/command-center/sabi-health/orders/${o.id}`)} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-emerald-50/35"><td className="cc-td font-mono text-xs">{o.id}</td><td className="cc-td"><StatusPill status={o.status.replaceAll("_", " ")} /></td><td className="cc-td">{o.currency} {o.total.toLocaleString()}</td></tr>)}</tbody></table>}</div></Panel>

        <Panel><PanelHeader title="Case history" /><div className="divide-y divide-slate-100">{auditEvents.length === 0 ? <p className="p-4 text-sm text-slate-500">No operational decisions recorded yet.</p> : auditEvents.map((event) => <div key={event.id} className="px-4 py-3"><p className="text-sm font-semibold text-slate-800">{event.action}</p>{event.reason && <p className="mt-0.5 text-xs text-slate-500">{event.reason}</p>}<p className="mt-0.5 text-xs text-slate-400">{event.actorName} · {formatDate(event.timestamp)}</p></div>)}</div></Panel>
      </div>
    </div>

    <ReasonDialog pending={pending} onClose={() => setPending(null)} />
  </div>;
}
