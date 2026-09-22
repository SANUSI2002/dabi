import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, BadgeCheck, ShieldAlert } from "lucide-react";
import { useSabiHealth, orderNeedsAttention } from "../../useSabiHealth";
import { useCommandCenter } from "../../useCommandCenter";
import { hasPermission } from "../../access";
import { useAuth } from "@/store/useAuth";
import { formatDate } from "../../format";
import {
  BackLink, CommandButton, CommandPageHeader, Field, NotFound, Panel, PanelHeader,
  ReasonDialog, StatusPill, Summary, type PendingAction,
} from "./shared";

const TERMINAL = ["COMPLETED", "CANCELLED", "REFUNDED"];
const UNPAID = ["DRAFT", "AWAITING_PAYMENT"];

export default function OrderDetail() {
  const { orderId = "" } = useParams();
  const navigate = useNavigate();
  const state = useSabiHealth();
  const platformUsers = useCommandCenter((s) => s.platformUsers);
  const identity = useAuth((s) => s.identity);
  const actor = platformUsers.find((item) => item.id === identity?.platformUserId);
  const canManage = hasPermission(actor, "sabihealth.operations.manage");
  const canBill = hasPermission(actor, "sabihealth.billing.manage");
  const [pending, setPending] = useState<PendingAction | null>(null);

  const order = state.medicationOrders.find((item) => item.id === orderId);
  if (!order) return <NotFound label="Order not found" backTo="/command-center/sabi-health/orders" backLabel="Back to orders" />;

  const patient = state.patients.find((p) => p.id === order.patientId);
  const pharmacy = state.pharmacies.find((ph) => ph.id === order.pharmacyId);
  const prescription = state.prescriptions.find((rx) => rx.id === order.prescriptionId);
  const auditEvents = state.auditEvents.filter((e) => e.resourceType === "MedicationOrder" && e.resourceId === orderId);
  const attention = orderNeedsAttention(order);

  const promptCancel = () => setPending({
    title: "Cancel this order",
    description: "Marks the order as cancelled. Inventory and pharmacy-side fulfillment are managed by the telemedicine app once connected — this only updates Command Center's own record.",
    confirm: "Cancel order", danger: true,
    onConfirm: (reason) => { const result = state.cancelMedicationOrder(orderId, reason, actor?.id); if (!result.ok) throw new Error(result.error); },
  });
  const promptFlag = () => setPending({
    title: "Flag for refund review",
    description: "Sends this case to the payments team for review. This does not process a refund — no payment gateway is connected yet.",
    confirm: "Flag for refund review",
    onConfirm: (reason) => { const result = state.flagOrderForRefund(orderId, reason, actor?.id); if (!result.ok) throw new Error(result.error); },
  });
  const promptResolve = () => setPending({
    title: "Mark as reviewed",
    description: "Closes this case out of the operations queue with no refund action needed.",
    confirm: "Mark reviewed",
    onConfirm: (note) => { const result = state.markOrderReviewed(orderId, note, actor?.id); if (!result.ok) throw new Error(result.error); },
  });
  const promptRecordRefund = () => setPending({
    title: "Record refund as processed",
    description: "No payment gateway is connected — this only logs that the refund was completed manually through the payment processor's own dashboard. The reference below becomes part of the permanent audit trail.",
    confirm: "Record refund processed",
    onConfirm: (externalReference) => { const result = state.recordOrderRefund(orderId, externalReference, actor?.id); if (!result.ok) throw new Error(result.error); },
  });

  return <div>
    <BackLink to="/command-center/sabi-health/orders" label="Prescription & pharmacy operations" />
    <CommandPageHeader eyebrow={pharmacy?.businessName ?? "Unknown pharmacy"} title={patient?.name ?? "Unknown patient"} description={`${order.currency} ${order.total.toLocaleString()} · last updated ${formatDate(order.updatedAt)}`} actions={<StatusPill status={order.status.replaceAll("_", " ")} />} />
    {!canManage && <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldAlert size={18} className="shrink-0" /><span>Your role can view this case, but operational actions require <b>sabihealth.operations.manage</b>.</span></div>}

    {order.refundFlagged && order.status !== "REFUNDED" && <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span><b className="block">Flagged for refund review</b>{order.refundFlagReason} — awaiting the payments team. No refund has been processed; payment processing is not connected yet.</span></div>}
    {order.status === "REFUNDED" && order.refundFlagged && <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><BadgeCheck size={16} className="mt-0.5 shrink-0" /><span><b className="block">Refund recorded</b>Processed externally — see case history for the reference.</span></div>}
    {order.reviewedAt && order.status !== "REFUNDED" && <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><BadgeCheck size={16} className="mt-0.5 shrink-0" /><span><b className="block">Reviewed {formatDate(order.reviewedAt)}</b>{order.reviewNote}</span></div>}

    <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Summary label="Patient" value={patient ? <button className="text-emerald-700 underline" onClick={() => navigate(`/command-center/sabi-health/patients/${patient.id}`)}>{patient.name}</button> : "Unknown"} />
      <Summary label="Pharmacy" value={pharmacy ? <button className="text-emerald-700 underline" onClick={() => navigate(`/command-center/sabi-health/pharmacies/${pharmacy.id}`)}>{pharmacy.businessName}</button> : "Unknown"} />
      <Summary label="Prescription" value={prescription ? <button className="text-emerald-700 underline" onClick={() => navigate(`/command-center/sabi-health/prescriptions/${prescription.id}`)}>{prescription.id}</button> : "Unknown"} />
      <Summary label="Needs attention" value={attention ? "Yes" : "No"} />
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
      <div className="space-y-4">
        <Panel><PanelHeader title="Order details" /><div className="grid gap-x-8 gap-y-4 p-4 sm:grid-cols-2"><Field label="Total" value={`${order.currency} ${order.total.toLocaleString()}`} /><Field label="Created" value={formatDate(order.createdAt)} /><Field label="Last updated" value={formatDate(order.updatedAt)} /><Field label="Status" value={<StatusPill status={order.status.replaceAll("_", " ")} />} /></div></Panel>

        {order.refundFlagged && order.status !== "REFUNDED" ? (
          <Panel><PanelHeader title="Awaiting refund" description="This case is now finance's to close — record the refund once it's processed externally" /><div className="flex flex-wrap gap-2 p-4">
            <CommandButton disabled={!canBill} onClick={promptRecordRefund}>Record refund processed</CommandButton>
          </div>{!canBill && <p className="px-4 pb-4 text-xs text-slate-500">Requires <b>sabihealth.billing.manage</b>.</p>}</Panel>
        ) : canManage && !order.reviewedAt && attention && (
          <Panel><PanelHeader title="Resolve this case" description="Choose the outcome — refunds are only flagged here, never processed" /><div className="flex flex-wrap gap-2 p-4">
            {!TERMINAL.includes(order.status) && <CommandButton variant="danger" onClick={promptCancel}>Cancel order</CommandButton>}
            {!UNPAID.includes(order.status) && <CommandButton variant="secondary" onClick={promptFlag}>Flag for refund review</CommandButton>}
            <CommandButton onClick={promptResolve}>Mark reviewed — no refund needed</CommandButton>
          </div></Panel>
        )}

        <Panel><PanelHeader title="Case history" /><div className="divide-y divide-slate-100">{auditEvents.length === 0 ? <p className="p-4 text-sm text-slate-500">No operational decisions recorded yet.</p> : auditEvents.map((event) => <div key={event.id} className="px-4 py-3"><p className="text-sm font-semibold text-slate-800">{event.action}</p>{event.reason && <p className="mt-0.5 text-xs text-slate-500">{event.reason}</p>}<p className="mt-0.5 text-xs text-slate-400">{event.actorName} · {formatDate(event.timestamp)}</p></div>)}</div></Panel>
      </div>
    </div>

    <ReasonDialog pending={pending} onClose={() => setPending(null)} />
  </div>;
}
