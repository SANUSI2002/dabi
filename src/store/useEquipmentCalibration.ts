import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { useEquipment } from "@/store/useEquipment";
import { useEquipmentEvents } from "@/store/useEquipmentEvents";
import type { CalibrationRecord, CalibrationResult } from "@/data/equipmentCalibration";
import { persisted } from "@/platform/persist";

const rid = () => Math.random().toString(36).slice(2, 9);

type EquipmentCalibrationState = {
  records: CalibrationRecord[];

  scheduleCalibration: (equipmentId: string, scheduledFor: string, vendor?: string, technician?: string) => CalibrationRecord;
  startCalibration: (id: string) => void;
  completeCalibration: (id: string, input: { result: CalibrationResult; certificateNumber?: string; certificateExpiry?: string; standardsUsed?: string; notes?: string }) => void;
  cancelCalibration: (id: string, reason: string) => void;

  recordsFor: (equipmentId: string) => CalibrationRecord[];
  lastCompletedFor: (equipmentId: string) => CalibrationRecord | undefined;
};

export const useEquipmentCalibration = create<EquipmentCalibrationState>(persisted<EquipmentCalibrationState>("equipment-calibration", (set, get) => ({
  records: [],

  scheduleCalibration: (equipmentId, scheduledFor, vendor, technician) => {
    const who = useIdentity.getState().user.name;
    const eq = useEquipment.getState().equipmentById(equipmentId);
    const record: CalibrationRecord = {
      id: rid(),
      equipmentId,
      status: "Scheduled",
      scheduledFor,
      requestedAt: new Date().toISOString(),
      requestedBy: who,
      vendor,
      technician,
    };
    audit("scheduled equipment calibration", `equipment-scada/${eq?.equipmentId ?? equipmentId}`, { user: who, meta: { scheduledFor } });
    set((s) => ({ records: [record, ...s.records] }));
    return record;
  },

  startCalibration: (id) => {
    const who = useIdentity.getState().user.name;
    const record = get().records.find((r) => r.id === id);
    if (!record) return;
    audit("started equipment calibration", `equipment-scada/calibration/${id}`, { user: who });
    set((s) => ({ records: s.records.map((r) => (r.id === id ? { ...r, status: "In Progress" } : r)) }));
    useEquipmentEvents.getState().logEvent({ equipmentId: record.equipmentId, type: "CALIBRATION_STARTED", source: "USER", actor: who, correlationId: id });
  },

  completeCalibration: (id, input) => {
    const who = useIdentity.getState().user.name;
    const record = get().records.find((r) => r.id === id);
    if (!record) return;
    audit("completed equipment calibration", `equipment-scada/calibration/${id}`, { user: who, meta: input });
    set((s) => ({
      records: s.records.map((r) =>
        r.id === id
          ? { ...r, status: "Completed", performedAt: new Date().toISOString(), result: input.result, certificateNumber: input.certificateNumber, certificateExpiry: input.certificateExpiry, standardsUsed: input.standardsUsed, notes: input.notes }
          : r,
      ),
    }));
    const events = useEquipmentEvents.getState();
    events.logEvent({ equipmentId: record.equipmentId, type: "CALIBRATION_COMPLETED", source: "USER", actor: who, detail: `Result: ${input.result}`, correlationId: id });
    if (input.result === "Pass") {
      for (const alarm of events.openAlarmsFor(record.equipmentId).filter((a) => a.category === "Calibration")) {
        events.resolveAlarm(alarm.id, "Calibration completed and passed");
      }
    }
  },

  cancelCalibration: (id, reason) => {
    const who = useIdentity.getState().user.name;
    audit("cancelled equipment calibration", `equipment-scada/calibration/${id}`, { user: who, meta: { reason } });
    set((s) => ({ records: s.records.map((r) => (r.id === id ? { ...r, status: "Cancelled", cancelReason: reason } : r)) }));
  },

  recordsFor: (equipmentId) => get().records.filter((r) => r.equipmentId === equipmentId),

  lastCompletedFor: (equipmentId) => {
    const completed = get().records
      .filter((r) => r.equipmentId === equipmentId && r.status === "Completed" && r.performedAt)
      .sort((a, b) => (b.performedAt! < a.performedAt! ? -1 : 1));
    return completed[0];
  },
})));
