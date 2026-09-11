import { useState } from "react";
import { Gauge } from "lucide-react";
import { Card, Button, Badge, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useEquipmentCalibration } from "@/store/useEquipmentCalibration";
import type { EquipmentRecord } from "@/data/equipment";
import type { CalibrationRecord, CalibrationResult } from "@/data/equipmentCalibration";
import { shortDate, dateTime, isoDate } from "@/lib/format";

export function CalibrationTab({ eq }: { eq: EquipmentRecord }) {
  const cal = useEquipmentCalibration();
  const calRecords = cal.recordsFor(eq.id);

  const [calModal, setCalModal] = useState(false);
  const [calForm, setCalForm] = useState({ scheduledFor: isoDate(new Date()), vendor: "", technician: "" });
  const [completeCalId, setCompleteCalId] = useState<string | null>(null);
  const [completeCalForm, setCompleteCalForm] = useState({ result: "Pass" as CalibrationResult, certificateNumber: "", certificateExpiry: "", standardsUsed: "", notes: "" });

  return (
    <div className="space-y-4">
      <Button variant="soft" onClick={() => { setCalForm({ scheduledFor: isoDate(new Date()), vendor: "", technician: "" }); setCalModal(true); }}>
        <Gauge size={14} /> Schedule Calibration
      </Button>

      {calRecords.length === 0 ? (
        <EmptyState title="No calibration records yet" hint="Schedule a calibration to start tracking compliance for this device." />
      ) : (
        <div className="space-y-3">
          {calRecords.map((record) => (
            <CalibrationCard
              key={record.id}
              record={record}
              onStart={() => cal.startCalibration(record.id)}
              onComplete={() => { setCompleteCalId(record.id); setCompleteCalForm({ result: "Pass", certificateNumber: "", certificateExpiry: "", standardsUsed: "", notes: "" }); }}
              onCancel={() => cal.cancelCalibration(record.id, "Cancelled from equipment detail")}
            />
          ))}
        </div>
      )}

      <Modal
        open={calModal}
        onClose={() => setCalModal(false)}
        title="Schedule Calibration"
        footer={<><Button variant="ghost" onClick={() => setCalModal(false)}>Cancel</Button>
          <Button onClick={() => { cal.scheduleCalibration(eq.id, new Date(calForm.scheduledFor).toISOString(), calForm.vendor || undefined, calForm.technician || undefined); setCalModal(false); }}>
            Schedule
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="Scheduled for"><Input type="date" value={calForm.scheduledFor} onChange={(e) => setCalForm({ ...calForm, scheduledFor: e.target.value })} /></Field>
          <Field label="Vendor" hint="Optional"><Input value={calForm.vendor} onChange={(e) => setCalForm({ ...calForm, vendor: e.target.value })} /></Field>
          <Field label="Technician" hint="Optional"><Input value={calForm.technician} onChange={(e) => setCalForm({ ...calForm, technician: e.target.value })} /></Field>
        </div>
      </Modal>

      {completeCalId && (
        <Modal
          open
          onClose={() => setCompleteCalId(null)}
          title="Complete Calibration"
          footer={<><Button variant="ghost" onClick={() => setCompleteCalId(null)}>Cancel</Button>
            <Button
              onClick={() => {
                cal.completeCalibration(completeCalId, {
                  result: completeCalForm.result,
                  certificateNumber: completeCalForm.certificateNumber || undefined,
                  certificateExpiry: completeCalForm.certificateExpiry ? new Date(completeCalForm.certificateExpiry).toISOString() : undefined,
                  standardsUsed: completeCalForm.standardsUsed || undefined,
                  notes: completeCalForm.notes || undefined,
                });
                setCompleteCalId(null);
              }}
            >
              Complete
            </Button></>}
        >
          <div className="space-y-4">
            <Field label="Result"><Select value={completeCalForm.result} onChange={(e) => setCompleteCalForm({ ...completeCalForm, result: e.target.value as CalibrationResult })} options={["Pass", "Fail"]} /></Field>
            <Field label="Standards used" hint="Optional"><Input value={completeCalForm.standardsUsed} onChange={(e) => setCompleteCalForm({ ...completeCalForm, standardsUsed: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Certificate number" hint="Optional"><Input value={completeCalForm.certificateNumber} onChange={(e) => setCompleteCalForm({ ...completeCalForm, certificateNumber: e.target.value })} /></Field>
              <Field label="Certificate expiry" hint="Optional"><Input type="date" value={completeCalForm.certificateExpiry} onChange={(e) => setCompleteCalForm({ ...completeCalForm, certificateExpiry: e.target.value })} /></Field>
            </div>
            <Field label="Notes" hint="Optional"><Textarea value={completeCalForm.notes} onChange={(e) => setCompleteCalForm({ ...completeCalForm, notes: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CalibrationCard({ record, onStart, onComplete, onCancel }: { record: CalibrationRecord; onStart: () => void; onComplete: () => void; onCancel: () => void }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-mist-600">{record.status}</span>
          {record.result && <Badge tone={record.result === "Pass" ? "brand" : "action"}>{record.result}</Badge>}
        </div>
        <span className="text-[11px] text-mist-300">Scheduled {shortDate(record.scheduledFor)}</span>
      </div>
      <p className="mt-1 text-xs text-mist-500">
        {record.vendor && `Vendor: ${record.vendor} · `}{record.technician && `Technician: ${record.technician}`}
      </p>
      {record.status === "Scheduled" && (
        <div className="mt-2 flex gap-1.5">
          <button onClick={onStart} className="btn-primary px-2.5 py-1 text-xs">Start</button>
          <button onClick={onCancel} className="text-xs text-mist-400 hover:text-action-600">Cancel</button>
        </div>
      )}
      {record.status === "In Progress" && (
        <div className="mt-2">
          <button onClick={onComplete} className="btn-primary px-2.5 py-1 text-xs">Record Result</button>
        </div>
      )}
      {record.status === "Completed" && (
        <p className="mt-2 text-xs text-mist-400">
          {record.performedAt && dateTime(record.performedAt)}
          {record.certificateNumber && ` · Cert. ${record.certificateNumber}`}
          {record.certificateExpiry && ` · expires ${shortDate(record.certificateExpiry)}`}
        </p>
      )}
      {record.status === "Cancelled" && <p className="mt-2 text-xs text-mist-400">Cancelled — {record.cancelReason}</p>}
    </Card>
  );
}
