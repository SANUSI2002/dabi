import { useState } from "react";
import { Wrench, TriangleAlert, Plus, Trash2 } from "lucide-react";
import { Card, Button, Badge, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Checkbox, Textarea } from "@/components/ui/form";
import { useEquipmentMaintenance } from "@/store/useEquipmentMaintenance";
import type { EquipmentRecord } from "@/data/equipment";
import type { WorkOrder, WorkOrderSeverity } from "@/data/equipmentMaintenance";
import { shortDate, dateTime, isoDate } from "@/lib/format";

const SEVERITIES: WorkOrderSeverity[] = ["Low", "Medium", "High", "Critical"];

export function MaintenanceTab({ eq }: { eq: EquipmentRecord }) {
  const maint = useEquipmentMaintenance();
  const workOrders = maint.workOrdersFor(eq.id);

  const [failureModal, setFailureModal] = useState(false);
  const [failureForm, setFailureForm] = useState({ description: "", severity: "Medium" as WorkOrderSeverity, failureCategory: "" });
  const [pmModal, setPmModal] = useState(false);
  const [pmForm, setPmForm] = useState({ scheduledFor: isoDate(new Date()), technician: "" });
  const [completeWoId, setCompleteWoId] = useState<string | null>(null);
  const [completeWoForm, setCompleteWoForm] = useState({ laborCost: "", downtimeMinutes: "", returnToServiceTested: false, returnToServiceNote: "" });
  const [partForm, setPartForm] = useState<Record<string, { name: string; qty: string; cost: string }>>({});

  function partFormFor(woId: string) {
    return partForm[woId] ?? { name: "", qty: "1", cost: "0" };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="action" onClick={() => { setFailureForm({ description: "", severity: "Medium", failureCategory: "" }); setFailureModal(true); }}>
          <TriangleAlert size={14} /> Report Failure
        </Button>
        <Button variant="soft" onClick={() => { setPmForm({ scheduledFor: isoDate(new Date()), technician: "" }); setPmModal(true); }}>
          <Wrench size={14} /> Schedule Preventive Maintenance
        </Button>
      </div>

      {workOrders.length === 0 ? (
        <EmptyState title="No work orders yet" hint="Report a failure or schedule preventive maintenance to start one." />
      ) : (
        <div className="space-y-3">
          {workOrders.map((wo) => (
            <WorkOrderCard
              key={wo.id}
              wo={wo}
              onStart={() => maint.startWorkOrder(wo.id)}
              onChecklist={(itemId, done) => maint.setChecklistItem(wo.id, itemId, done)}
              onDiagnosis={(diagnosis, correctiveAction) => maint.recordDiagnosis(wo.id, diagnosis, correctiveAction)}
              onAddPart={() => {
                const f = partFormFor(wo.id);
                if (!f.name.trim()) return;
                maint.addPart(wo.id, { name: f.name.trim(), qty: +f.qty || 1, cost: +f.cost || 0 });
                setPartForm((s) => ({ ...s, [wo.id]: { name: "", qty: "1", cost: "0" } }));
              }}
              onRemovePart={(i) => maint.removePart(wo.id, i)}
              partForm={partFormFor(wo.id)}
              onPartFormChange={(patch) => setPartForm((s) => ({ ...s, [wo.id]: { ...partFormFor(wo.id), ...patch } }))}
              onComplete={() => { setCompleteWoId(wo.id); setCompleteWoForm({ laborCost: "", downtimeMinutes: "", returnToServiceTested: false, returnToServiceNote: "" }); }}
              onCancel={() => maint.cancelWorkOrder(wo.id, "Cancelled from equipment detail")}
            />
          ))}
        </div>
      )}

      <Modal
        open={failureModal}
        onClose={() => setFailureModal(false)}
        title="Report Equipment Failure"
        footer={<><Button variant="ghost" onClick={() => setFailureModal(false)}>Cancel</Button>
          <Button disabled={!failureForm.description.trim()} onClick={() => { maint.reportFailure(eq.id, failureForm.description.trim(), failureForm.severity, failureForm.failureCategory || undefined); setFailureModal(false); }}>
            Create Work Order
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="What failed?"><Textarea value={failureForm.description} onChange={(e) => setFailureForm({ ...failureForm, description: e.target.value })} placeholder="Describe the fault…" /></Field>
          <Field label="Severity"><Select value={failureForm.severity} onChange={(e) => setFailureForm({ ...failureForm, severity: e.target.value as WorkOrderSeverity })} options={SEVERITIES} /></Field>
          <Field label="Failure category" hint="Optional"><Input value={failureForm.failureCategory} onChange={(e) => setFailureForm({ ...failureForm, failureCategory: e.target.value })} placeholder="e.g. Electrical, Mechanical, Sensor" /></Field>
          {failureForm.severity === "Critical" && <p className="rounded-xl bg-action-50 px-3 py-2 text-xs text-action-700">Critical severity creates an Emergency work order.</p>}
        </div>
      </Modal>

      <Modal
        open={pmModal}
        onClose={() => setPmModal(false)}
        title="Schedule Preventive Maintenance"
        footer={<><Button variant="ghost" onClick={() => setPmModal(false)}>Cancel</Button>
          <Button onClick={() => { maint.schedulePreventive(eq.id, new Date(pmForm.scheduledFor).toISOString(), pmForm.technician || undefined); setPmModal(false); }}>
            Schedule
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="Scheduled for"><Input type="date" value={pmForm.scheduledFor} onChange={(e) => setPmForm({ ...pmForm, scheduledFor: e.target.value })} /></Field>
          <Field label="Technician" hint="Optional"><Input value={pmForm.technician} onChange={(e) => setPmForm({ ...pmForm, technician: e.target.value })} /></Field>
        </div>
      </Modal>

      {completeWoId && (
        <Modal
          open
          onClose={() => setCompleteWoId(null)}
          title="Complete Work Order"
          footer={<><Button variant="ghost" onClick={() => setCompleteWoId(null)}>Cancel</Button>
            <Button
              disabled={!completeWoForm.returnToServiceTested}
              onClick={() => {
                maint.completeWorkOrder(completeWoId, {
                  laborCost: completeWoForm.laborCost ? +completeWoForm.laborCost : undefined,
                  downtimeMinutes: completeWoForm.downtimeMinutes ? +completeWoForm.downtimeMinutes : undefined,
                  returnToServiceTested: completeWoForm.returnToServiceTested,
                  returnToServiceNote: completeWoForm.returnToServiceNote || undefined,
                });
                setCompleteWoId(null);
              }}
            >
              Complete
            </Button></>}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Labor cost (₦)" hint="Optional"><Input type="number" value={completeWoForm.laborCost} onChange={(e) => setCompleteWoForm({ ...completeWoForm, laborCost: e.target.value })} /></Field>
              <Field label="Downtime (minutes)" hint="Optional"><Input type="number" value={completeWoForm.downtimeMinutes} onChange={(e) => setCompleteWoForm({ ...completeWoForm, downtimeMinutes: e.target.value })} /></Field>
            </div>
            <Checkbox
              label="Return-to-service test passed"
              checked={completeWoForm.returnToServiceTested}
              onChange={(e) => setCompleteWoForm({ ...completeWoForm, returnToServiceTested: e.target.checked })}
            />
            <Field label="Return-to-service note" hint="Optional"><Textarea value={completeWoForm.returnToServiceNote} onChange={(e) => setCompleteWoForm({ ...completeWoForm, returnToServiceNote: e.target.value })} /></Field>
            {!completeWoForm.returnToServiceTested && <p className="text-xs text-mist-400">A work order cannot be completed without a passed return-to-service test.</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}

function WorkOrderCard({
  wo, onStart, onChecklist, onDiagnosis, onAddPart, onRemovePart, partForm, onPartFormChange, onComplete, onCancel,
}: {
  wo: WorkOrder;
  onStart: () => void;
  onChecklist: (itemId: string, done: boolean) => void;
  onDiagnosis: (diagnosis: string, correctiveAction: string) => void;
  onAddPart: () => void;
  onRemovePart: (index: number) => void;
  partForm: { name: string; qty: string; cost: string };
  onPartFormChange: (patch: Partial<{ name: string; qty: string; cost: string }>) => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const open = !["Completed", "Cancelled"].includes(wo.status);
  const partsTotal = wo.partsUsed.reduce((n, p) => n + p.qty * p.cost, 0);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={wo.type === "Emergency" ? "action" : wo.type === "Corrective" ? "amber" : "mist"}>{wo.type}</Badge>
          <Badge tone={wo.severity === "Critical" || wo.severity === "High" ? "action" : wo.severity === "Medium" ? "amber" : "mist"}>{wo.severity}</Badge>
          <span className="text-xs font-semibold text-mist-600">{wo.status}</span>
        </div>
        <span className="text-[11px] text-mist-300">{dateTime(wo.reportedAt)} · {wo.reportedBy}</span>
      </div>
      <p className="mt-1.5 text-sm text-mist-700">{wo.description}</p>
      {wo.scheduledFor && <p className="mt-1 text-xs text-mist-400">Scheduled for {shortDate(wo.scheduledFor)}{wo.technician ? ` · ${wo.technician}` : ""}</p>}

      {(wo.status === "Requested" || wo.status === "Scheduled") && (
        <div className="mt-2">
          <button onClick={onStart} className="btn-primary px-2.5 py-1 text-xs">Start Work</button>
        </div>
      )}

      {wo.status === "In Progress" && (
        <div className="mt-3 space-y-3 border-t border-mist-100 pt-3">
          {wo.checklist.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-mist-500">Checklist</p>
              <div className="grid grid-cols-2 gap-1.5">
                {wo.checklist.map((item) => (
                  <Checkbox key={item.id} label={item.label} checked={item.done} onChange={(e) => onChecklist(item.id, e.target.checked)} />
                ))}
              </div>
            </div>
          )}
          {wo.type !== "Preventive" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Diagnosis"><Textarea value={wo.diagnosis ?? ""} onChange={(e) => onDiagnosis(e.target.value, wo.correctiveAction ?? "")} /></Field>
              <Field label="Corrective action"><Textarea value={wo.correctiveAction ?? ""} onChange={(e) => onDiagnosis(wo.diagnosis ?? "", e.target.value)} /></Field>
            </div>
          )}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-mist-500">Parts used {partsTotal > 0 && <span className="text-mist-400">· ₦{partsTotal.toLocaleString()}</span>}</p>
            {wo.partsUsed.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-0.5 text-xs text-mist-600">
                <span>{p.name} × {p.qty} — ₦{(p.qty * p.cost).toLocaleString()}</span>
                <button onClick={() => onRemovePart(i)} className="text-mist-400 hover:text-action-600"><Trash2 size={12} /></button>
              </div>
            ))}
            <div className="mt-1.5 grid grid-cols-[1fr_60px_80px_28px] items-center gap-1.5">
              <input className="input py-1 text-xs" placeholder="Part name" value={partForm.name} onChange={(e) => onPartFormChange({ name: e.target.value })} />
              <input className="input py-1 text-center text-xs" type="number" min={1} value={partForm.qty} onChange={(e) => onPartFormChange({ qty: e.target.value })} />
              <input className="input py-1 text-right text-xs" type="number" min={0} value={partForm.cost} onChange={(e) => onPartFormChange({ cost: e.target.value })} />
              <button onClick={onAddPart} className="text-brand-600 hover:text-brand-700"><Plus size={14} /></button>
            </div>
          </div>
          <button onClick={onComplete} className="btn-primary px-2.5 py-1 text-xs">Complete Work Order</button>
        </div>
      )}

      {wo.status === "Completed" && (
        <p className="mt-2 text-xs text-mist-400">
          Completed {wo.completedAt ? dateTime(wo.completedAt) : ""}
          {wo.downtimeMinutes ? ` · ${wo.downtimeMinutes} min downtime` : ""}
          {wo.laborCost ? ` · ₦${wo.laborCost.toLocaleString()} labor` : ""} · RTS test {wo.returnToServiceTested ? "passed" : "not recorded"}
        </p>
      )}
      {wo.status === "Cancelled" && <p className="mt-2 text-xs text-mist-400">Cancelled — {wo.cancelReason}</p>}

      {open && wo.status !== "In Progress" && (
        <div className="mt-2">
          <button onClick={onCancel} className="text-xs text-mist-400 hover:text-action-600">Cancel work order</button>
        </div>
      )}
    </Card>
  );
}
