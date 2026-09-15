import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { useEquipment } from "@/store/useEquipment";
import { useEquipmentEvents } from "@/store/useEquipmentEvents";
import { defaultChecklistFor, type WorkOrder, type WorkOrderSeverity, type PartUsed } from "@/data/equipmentMaintenance";
import { persisted } from "@/platform/persist";

const rid = () => Math.random().toString(36).slice(2, 9);

type EquipmentMaintenanceState = {
  workOrders: WorkOrder[];

  reportFailure: (equipmentId: string, description: string, severity: WorkOrderSeverity, failureCategory?: string) => WorkOrder;
  schedulePreventive: (equipmentId: string, scheduledFor: string, technician?: string) => WorkOrder;
  startWorkOrder: (id: string, technician?: string) => void;
  setChecklistItem: (id: string, itemId: string, done: boolean, note?: string) => void;
  recordDiagnosis: (id: string, diagnosis: string, correctiveAction: string) => void;
  addPart: (id: string, part: PartUsed) => void;
  removePart: (id: string, index: number) => void;
  completeWorkOrder: (id: string, input: { laborCost?: number; downtimeMinutes?: number; returnToServiceTested: boolean; returnToServiceNote?: string }) => void;
  cancelWorkOrder: (id: string, reason: string) => void;

  workOrdersFor: (equipmentId: string) => WorkOrder[];
  openWorkOrdersFor: (equipmentId: string) => WorkOrder[];
  lastPreventiveCompletedAt: (equipmentId: string) => string | undefined;
};

export const useEquipmentMaintenance = create<EquipmentMaintenanceState>(persisted<EquipmentMaintenanceState>("equipment-maintenance", (set, get) => ({
  workOrders: [],

  reportFailure: (equipmentId, description, severity, failureCategory) => {
    const who = useIdentity.getState().user.name;
    const eq = useEquipment.getState().equipmentById(equipmentId);
    const wo: WorkOrder = {
      id: rid(),
      equipmentId,
      type: severity === "Critical" ? "Emergency" : "Corrective",
      status: "Requested",
      severity,
      reportedAt: new Date().toISOString(),
      reportedBy: who,
      failureCategory,
      description,
      checklist: eq ? defaultChecklistFor(eq.category) : [],
      partsUsed: [],
    };
    audit("reported equipment failure", `equipment-scada/${eq?.equipmentId ?? equipmentId}`, { user: who, meta: { severity, description } });
    set((s) => ({ workOrders: [wo, ...s.workOrders] }));
    return wo;
  },

  schedulePreventive: (equipmentId, scheduledFor, technician) => {
    const who = useIdentity.getState().user.name;
    const eq = useEquipment.getState().equipmentById(equipmentId);
    const wo: WorkOrder = {
      id: rid(),
      equipmentId,
      type: "Preventive",
      status: "Scheduled",
      severity: "Low",
      reportedAt: new Date().toISOString(),
      reportedBy: who,
      description: "Scheduled preventive maintenance",
      scheduledFor,
      technician,
      checklist: eq ? defaultChecklistFor(eq.category) : [],
      partsUsed: [],
    };
    audit("scheduled preventive maintenance", `equipment-scada/${eq?.equipmentId ?? equipmentId}`, { user: who, meta: { scheduledFor } });
    set((s) => ({ workOrders: [wo, ...s.workOrders] }));
    return wo;
  },

  startWorkOrder: (id, technician) => {
    const who = useIdentity.getState().user.name;
    const wo = get().workOrders.find((w) => w.id === id);
    if (!wo) return;
    audit("started equipment work order", `equipment-scada/workorder/${id}`, { user: who });
    set((s) => ({
      workOrders: s.workOrders.map((w) => (w.id === id ? { ...w, status: "In Progress", startedAt: new Date().toISOString(), technician: technician ?? w.technician } : w)),
    }));
    useEquipmentEvents.getState().logEvent({ equipmentId: wo.equipmentId, type: "MAINTENANCE_STARTED", source: "USER", actor: who, detail: wo.description, correlationId: id });
  },

  setChecklistItem: (id, itemId, done, note) => {
    set((s) => ({
      workOrders: s.workOrders.map((w) =>
        w.id === id ? { ...w, checklist: w.checklist.map((c) => (c.id === itemId ? { ...c, done, note: note ?? c.note } : c)) } : w,
      ),
    }));
  },

  recordDiagnosis: (id, diagnosis, correctiveAction) => {
    set((s) => ({ workOrders: s.workOrders.map((w) => (w.id === id ? { ...w, diagnosis, correctiveAction } : w)) }));
  },

  addPart: (id, part) => {
    set((s) => ({ workOrders: s.workOrders.map((w) => (w.id === id ? { ...w, partsUsed: [...w.partsUsed, part] } : w)) }));
  },

  removePart: (id, index) => {
    set((s) => ({ workOrders: s.workOrders.map((w) => (w.id === id ? { ...w, partsUsed: w.partsUsed.filter((_, i) => i !== index) } : w)) }));
  },

  completeWorkOrder: (id, input) => {
    const who = useIdentity.getState().user.name;
    const wo = get().workOrders.find((w) => w.id === id);
    if (!wo) return;
    audit("completed equipment work order", `equipment-scada/workorder/${id}`, { user: who, meta: input });
    set((s) => ({
      workOrders: s.workOrders.map((w) =>
        w.id === id
          ? { ...w, status: "Completed", completedAt: new Date().toISOString(), laborCost: input.laborCost, downtimeMinutes: input.downtimeMinutes, returnToServiceTested: input.returnToServiceTested, returnToServiceNote: input.returnToServiceNote }
          : w,
      ),
    }));
    const events = useEquipmentEvents.getState();
    events.logEvent({ equipmentId: wo.equipmentId, type: "MAINTENANCE_COMPLETED", source: "USER", actor: who, detail: wo.description, correlationId: id });
    if (input.returnToServiceTested) events.logEvent({ equipmentId: wo.equipmentId, type: "REPAIRED", source: "USER", actor: who, correlationId: id });
    // Real integration: completing the work order that responds to an overdue-maintenance alarm
    // resolves that alarm, closing the loop the directive's Scenario C describes end to end.
    for (const alarm of events.openAlarmsFor(wo.equipmentId).filter((a) => a.category === "Maintenance")) {
      events.resolveAlarm(alarm.id, `Resolved by work order — ${wo.description}`);
    }
  },

  cancelWorkOrder: (id, reason) => {
    const who = useIdentity.getState().user.name;
    audit("cancelled equipment work order", `equipment-scada/workorder/${id}`, { user: who, meta: { reason } });
    set((s) => ({ workOrders: s.workOrders.map((w) => (w.id === id ? { ...w, status: "Cancelled", cancelReason: reason } : w)) }));
  },

  workOrdersFor: (equipmentId) => get().workOrders.filter((w) => w.equipmentId === equipmentId),
  openWorkOrdersFor: (equipmentId) => get().workOrders.filter((w) => w.equipmentId === equipmentId && !["Completed", "Cancelled"].includes(w.status)),

  lastPreventiveCompletedAt: (equipmentId) => {
    const completed = get().workOrders
      .filter((w) => w.equipmentId === equipmentId && w.type === "Preventive" && w.status === "Completed" && w.completedAt)
      .sort((a, b) => (b.completedAt! < a.completedAt! ? -1 : 1));
    return completed[0]?.completedAt;
  },
})));
