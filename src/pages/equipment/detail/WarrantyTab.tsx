import { useState } from "react";
import { Award, FileWarning } from "lucide-react";
import { Card, Button, Badge, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Checkbox, Textarea } from "@/components/ui/form";
import { useEquipmentWarranty } from "@/store/useEquipmentWarranty";
import { useEquipmentMaintenance } from "@/store/useEquipmentMaintenance";
import { warrantyStatusFor, type WarrantyClaim, type WarrantyClaimStatus } from "@/data/equipmentWarranty";
import { MaintenanceStateBadge } from "@/components/equipment/EquipmentStatusBadge";
import type { EquipmentRecord } from "@/data/equipment";
import type { WorkOrder } from "@/data/equipmentMaintenance";
import { shortDate, dateTime, isoDate } from "@/lib/format";

export function WarrantyTab({ eq }: { eq: EquipmentRecord }) {
  const warranty = useEquipmentWarranty();
  const maint = useEquipmentMaintenance();
  const warrantyInfo = warranty.warrantyFor(eq.id);
  const warrantyState = warrantyStatusFor(warrantyInfo);
  const claims = warranty.claimsFor(eq.id);
  const workOrders = maint.workOrdersFor(eq.id);

  const [warrantyModal, setWarrantyModal] = useState(false);
  const [warrantyForm, setWarrantyForm] = useState({ provider: "", start: isoDate(new Date()), end: isoDate(new Date()), coverage: "", contactName: "", contactPhone: "", slaHours: "" });
  const [claimModal, setClaimModal] = useState(false);
  const [claimForm, setClaimForm] = useState({ issue: "", relatedWorkOrderId: "" });
  const [completeClaimId, setCompleteClaimId] = useState<string | null>(null);
  const [completeClaimForm, setCompleteClaimForm] = useState({ repairedUnderWarranty: true, costRecovered: "", resolutionNote: "" });

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display font-bold text-mist-900"><Award size={16} /> Warranty Coverage</h3>
          <MaintenanceStateBadge state={warrantyState === "Not Tracked" ? "Not Due" : warrantyState === "Active" ? "Not Due" : warrantyState === "Expiring Soon" ? "Due Soon" : "Overdue"} />
        </div>
        {warrantyInfo ? (
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <Row2 k="Provider" v={warrantyInfo.provider} />
            <Row2 k="Coverage" v={warrantyInfo.coverage} />
            <Row2 k="Start" v={shortDate(warrantyInfo.start)} />
            <Row2 k="End" v={shortDate(warrantyInfo.end)} />
            {warrantyInfo.contactName && <Row2 k="Contact" v={warrantyInfo.contactName} />}
            {warrantyInfo.slaHours !== undefined && <Row2 k="Response SLA" v={`${warrantyInfo.slaHours}h`} />}
          </dl>
        ) : (
          <p className="text-sm text-mist-400">No warranty on file for this equipment.</p>
        )}
        <button
          onClick={() => {
            setWarrantyForm(
              warrantyInfo
                ? { provider: warrantyInfo.provider, start: isoDate(warrantyInfo.start), end: isoDate(warrantyInfo.end), coverage: warrantyInfo.coverage, contactName: warrantyInfo.contactName ?? "", contactPhone: warrantyInfo.contactPhone ?? "", slaHours: warrantyInfo.slaHours ? String(warrantyInfo.slaHours) : "" }
                : { provider: "", start: isoDate(new Date()), end: isoDate(new Date()), coverage: "", contactName: "", contactPhone: "", slaHours: "" },
            );
            setWarrantyModal(true);
          }}
          className="btn-soft mt-3 px-2.5 py-1 text-xs"
        >
          {warrantyInfo ? "Edit Warranty" : "Set Warranty"}
        </button>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display font-bold text-mist-900"><FileWarning size={16} /> Claims</h3>
        <Button variant="soft" onClick={() => { setClaimForm({ issue: "", relatedWorkOrderId: "" }); setClaimModal(true); }}>File Claim</Button>
      </div>
      {claims.length === 0 ? (
        <EmptyState title="No warranty claims filed" hint="File a claim when a repair should be covered under warranty." />
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              relatedWorkOrder={workOrders.find((w) => w.id === claim.relatedWorkOrderId)}
              onApprove={() => warranty.updateClaimStatus(claim.id, "Approved")}
              onReject={() => warranty.updateClaimStatus(claim.id, "Rejected", { resolutionNote: "Rejected by provider" })}
              onStartRepair={() => warranty.updateClaimStatus(claim.id, "In Repair")}
              onComplete={() => { setCompleteClaimId(claim.id); setCompleteClaimForm({ repairedUnderWarranty: true, costRecovered: "", resolutionNote: "" }); }}
            />
          ))}
        </div>
      )}

      <Modal
        open={warrantyModal}
        onClose={() => setWarrantyModal(false)}
        title="Warranty Coverage"
        footer={<><Button variant="ghost" onClick={() => setWarrantyModal(false)}>Cancel</Button>
          <Button
            disabled={!warrantyForm.provider.trim() || !warrantyForm.coverage.trim()}
            onClick={() => {
              warranty.setWarranty(eq.id, {
                provider: warrantyForm.provider.trim(), start: new Date(warrantyForm.start).toISOString(), end: new Date(warrantyForm.end).toISOString(),
                coverage: warrantyForm.coverage.trim(), contactName: warrantyForm.contactName || undefined, contactPhone: warrantyForm.contactPhone || undefined,
                slaHours: warrantyForm.slaHours ? +warrantyForm.slaHours : undefined,
              });
              setWarrantyModal(false);
            }}
          >
            Save
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="Provider"><Input value={warrantyForm.provider} onChange={(e) => setWarrantyForm({ ...warrantyForm, provider: e.target.value })} /></Field>
          <Field label="Coverage"><Textarea value={warrantyForm.coverage} onChange={(e) => setWarrantyForm({ ...warrantyForm, coverage: e.target.value })} placeholder="e.g. Parts and labor, excludes consumables" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start"><Input type="date" value={warrantyForm.start} onChange={(e) => setWarrantyForm({ ...warrantyForm, start: e.target.value })} /></Field>
            <Field label="End"><Input type="date" value={warrantyForm.end} onChange={(e) => setWarrantyForm({ ...warrantyForm, end: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact name" hint="Optional"><Input value={warrantyForm.contactName} onChange={(e) => setWarrantyForm({ ...warrantyForm, contactName: e.target.value })} /></Field>
            <Field label="Contact phone" hint="Optional"><Input value={warrantyForm.contactPhone} onChange={(e) => setWarrantyForm({ ...warrantyForm, contactPhone: e.target.value })} /></Field>
          </div>
          <Field label="Response SLA (hours)" hint="Optional"><Input type="number" value={warrantyForm.slaHours} onChange={(e) => setWarrantyForm({ ...warrantyForm, slaHours: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal
        open={claimModal}
        onClose={() => setClaimModal(false)}
        title="File Warranty Claim"
        footer={<><Button variant="ghost" onClick={() => setClaimModal(false)}>Cancel</Button>
          <Button disabled={!claimForm.issue.trim()} onClick={() => { warranty.fileClaim(eq.id, claimForm.issue.trim(), claimForm.relatedWorkOrderId || undefined); setClaimModal(false); }}>
            File Claim
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="Issue"><Textarea value={claimForm.issue} onChange={(e) => setClaimForm({ ...claimForm, issue: e.target.value })} placeholder="What needs to be covered under warranty?" /></Field>
          {workOrders.length > 0 && (
            <Field label="Linked work order" hint="Optional">
              <Select
                value={claimForm.relatedWorkOrderId}
                onChange={(e) => setClaimForm({ ...claimForm, relatedWorkOrderId: e.target.value })}
                options={[{ value: "", label: "None" }, ...workOrders.map((w) => ({ value: w.id, label: `${w.type} — ${w.description.slice(0, 40)}` }))]}
              />
            </Field>
          )}
        </div>
      </Modal>

      {completeClaimId && (
        <Modal
          open
          onClose={() => setCompleteClaimId(null)}
          title="Resolve Warranty Claim"
          footer={<><Button variant="ghost" onClick={() => setCompleteClaimId(null)}>Cancel</Button>
            <Button
              onClick={() => {
                warranty.updateClaimStatus(completeClaimId, "Completed", {
                  repairedUnderWarranty: completeClaimForm.repairedUnderWarranty,
                  costRecovered: completeClaimForm.costRecovered ? +completeClaimForm.costRecovered : undefined,
                  resolutionNote: completeClaimForm.resolutionNote || undefined,
                });
                setCompleteClaimId(null);
              }}
            >
              Complete
            </Button></>}
        >
          <div className="space-y-4">
            <Checkbox
              label="Repaired under warranty (no cost to facility)"
              checked={completeClaimForm.repairedUnderWarranty}
              onChange={(e) => setCompleteClaimForm({ ...completeClaimForm, repairedUnderWarranty: e.target.checked })}
            />
            <Field label="Cost recovered (₦)" hint="Optional — e.g. parts reimbursed"><Input type="number" value={completeClaimForm.costRecovered} onChange={(e) => setCompleteClaimForm({ ...completeClaimForm, costRecovered: e.target.value })} /></Field>
            <Field label="Resolution note" hint="Optional"><Textarea value={completeClaimForm.resolutionNote} onChange={(e) => setCompleteClaimForm({ ...completeClaimForm, resolutionNote: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Row2({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-mist-400">{k}</dt>
      <dd className="font-semibold text-mist-800">{v}</dd>
    </div>
  );
}

function ClaimCard({
  claim, relatedWorkOrder, onApprove, onReject, onStartRepair, onComplete,
}: {
  claim: WarrantyClaim;
  relatedWorkOrder?: WorkOrder;
  onApprove: () => void;
  onReject: () => void;
  onStartRepair: () => void;
  onComplete: () => void;
}) {
  const tone: Record<WarrantyClaimStatus, "brand" | "action" | "mist" | "amber"> = {
    Submitted: "amber", Approved: "brand", "In Repair": "amber", Rejected: "action", Completed: "brand",
  };
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone={tone[claim.status]}>{claim.status}</Badge>
        <span className="text-[11px] text-mist-300">{dateTime(claim.raisedAt)} · {claim.raisedBy}</span>
      </div>
      <p className="mt-1.5 text-sm text-mist-700">{claim.issue}</p>
      {relatedWorkOrder && <p className="mt-1 text-xs text-mist-400">Linked to work order: {relatedWorkOrder.description}</p>}
      {claim.status === "Completed" && (
        <p className="mt-1 text-xs text-mist-400">
          {claim.repairedUnderWarranty ? "Repaired under warranty" : "Not covered"}
          {claim.costRecovered ? ` · ₦${claim.costRecovered.toLocaleString()} recovered` : ""}
          {claim.resolutionNote ? ` · ${claim.resolutionNote}` : ""}
        </p>
      )}
      {claim.status === "Rejected" && claim.resolutionNote && <p className="mt-1 text-xs text-mist-400">{claim.resolutionNote}</p>}
      {claim.status === "Submitted" && (
        <div className="mt-2 flex gap-1.5">
          <button onClick={onApprove} className="btn-primary px-2.5 py-1 text-xs">Approve</button>
          <button onClick={onReject} className="text-xs text-mist-400 hover:text-action-600">Reject</button>
        </div>
      )}
      {claim.status === "Approved" && (
        <div className="mt-2">
          <button onClick={onStartRepair} className="btn-primary px-2.5 py-1 text-xs">Start Repair</button>
        </div>
      )}
      {claim.status === "In Repair" && (
        <div className="mt-2">
          <button onClick={onComplete} className="btn-primary px-2.5 py-1 text-xs">Complete</button>
        </div>
      )}
    </Card>
  );
}
