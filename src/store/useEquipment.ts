import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import {
  EQUIPMENT_SEED, newEquipmentId, type EquipmentRecord, type EquipmentCategory, type EquipmentLocation,
} from "@/data/equipment";
import {
  emptyHeartbeat, connectivityFromAge, type Heartbeat, type MachineState, type MaintenanceState, type SafetyState, type EquipmentStatus,
} from "@/data/equipmentState";
import { TELEMETRY_PARAMS, severityFor, type TelemetryReading, type TelemetryHistoryPoint } from "@/data/equipmentTelemetry";
import type { EquipmentAlarm } from "@/data/equipmentAlarms";

const rid = () => Math.random().toString(36).slice(2, 9);
const HISTORY_LIMIT = 200;

type EquipmentState = {
  equipment: EquipmentRecord[];
  heartbeats: Record<string, Heartbeat>;
  machineStates: Record<string, MachineState>;
  telemetryLatest: Record<string, Record<string, TelemetryReading>>;
  telemetryHistory: Record<string, Record<string, TelemetryHistoryPoint[]>>;
  runtimeTodaySec: Record<string, number>;

  equipmentById: (id: string) => EquipmentRecord | undefined;
  registerEquipment: (input: {
    name: string; category: EquipmentCategory; manufacturer: string; model: string; serialNumber: string;
    location: EquipmentLocation; ownership: EquipmentRecord["ownership"];
  }) => EquipmentRecord;
  transferEquipment: (id: string, to: EquipmentLocation, reason: string) => void;
  decommissionEquipment: (id: string, reason: string) => void;

  recordHeartbeat: (id: string, ok: boolean, latencyMs?: number) => void;
  setMachineState: (id: string, state: MachineState) => void;
  pushTelemetry: (id: string, key: string, value: number, category: EquipmentCategory) => void;
  addRuntime: (id: string, seconds: number) => void;

  connectivityFor: (id: string) => ReturnType<typeof connectivityFromAge>;
};

export const useEquipment = create<EquipmentState>((set, get) => ({
  equipment: EQUIPMENT_SEED,
  heartbeats: Object.fromEntries(EQUIPMENT_SEED.map((e) => [e.id, emptyHeartbeat()])),
  machineStates: Object.fromEntries(EQUIPMENT_SEED.map((e) => [e.id, "Ready" as MachineState])),
  telemetryLatest: {},
  telemetryHistory: {},
  runtimeTodaySec: {},

  equipmentById: (id) => get().equipment.find((e) => e.id === id),

  registerEquipment: (input) => {
    const who = useIdentity.getState().user.name;
    const sequence = get().equipment.filter((e) => e.category === input.category).length + 1;
    const record: EquipmentRecord = {
      id: rid(),
      equipmentId: newEquipmentId(input.category, sequence),
      name: input.name,
      category: input.category,
      manufacturer: input.manufacturer,
      model: input.model,
      serialNumber: input.serialNumber,
      ownership: input.ownership,
      location: input.location,
      procurement: {},
      lifecycle: { installationDate: new Date().toISOString() },
      technical: { integrationKind: "NOT_CONFIGURED" },
      compliance: { calibrationRequired: false },
      createdAt: new Date().toISOString(),
      registeredBy: who,
    };
    audit("registered equipment", `equipment/${record.equipmentId}`, { user: who });
    set((s) => ({
      equipment: [record, ...s.equipment],
      heartbeats: { ...s.heartbeats, [record.id]: emptyHeartbeat() },
      machineStates: { ...s.machineStates, [record.id]: "Unknown" },
    }));
    return record;
  },

  transferEquipment: (id, to, reason) => {
    const who = useIdentity.getState().user.name;
    const eq = get().equipmentById(id);
    audit("transferred equipment", `equipment/${eq?.equipmentId ?? id}`, { user: who, meta: { reason, to } });
    set((s) => ({
      equipment: s.equipment.map((e) => (e.id === id ? { ...e, location: to } : e)),
    }));
  },

  decommissionEquipment: (id, reason) => {
    const who = useIdentity.getState().user.name;
    const eq = get().equipmentById(id);
    audit("decommissioned equipment", `equipment/${eq?.equipmentId ?? id}`, { user: who, meta: { reason } });
    set((s) => ({
      equipment: s.equipment.map((e) => (e.id === id ? { ...e, lifecycle: { ...e.lifecycle, decommissionDate: new Date().toISOString() } } : e)),
      machineStates: { ...s.machineStates, [id]: "Decommissioned" },
    }));
  },

  recordHeartbeat: (id, ok, latencyMs) => {
    set((s) => {
      const prev = s.heartbeats[id] ?? emptyHeartbeat();
      const at = new Date().toISOString();
      return {
        heartbeats: {
          ...s.heartbeats,
          [id]: {
            lastHeartbeatAt: at,
            lastSuccessAt: ok ? at : prev.lastSuccessAt,
            lastFailureAt: ok ? prev.lastFailureAt : at,
            consecutiveFailures: ok ? 0 : prev.consecutiveFailures + 1,
            connectionAttempts: prev.connectionAttempts + 1,
            latencyMs: latencyMs ?? prev.latencyMs,
          },
        },
      };
    });
  },

  setMachineState: (id, state) => set((s) => ({ machineStates: { ...s.machineStates, [id]: state } })),

  pushTelemetry: (id, key, value, category) => {
    const def = TELEMETRY_PARAMS[category]?.find((p) => p.key === key);
    if (!def) return;
    const at = new Date().toISOString();
    const reading: TelemetryReading = { key, value, at, severity: severityFor(def, value) };
    set((s) => {
      const latestForDevice = { ...(s.telemetryLatest[id] ?? {}), [key]: reading };
      const historyForDevice = { ...(s.telemetryHistory[id] ?? {}) };
      const series = [...(historyForDevice[key] ?? []), { at, value }];
      historyForDevice[key] = series.length > HISTORY_LIMIT ? series.slice(series.length - HISTORY_LIMIT) : series;
      return {
        telemetryLatest: { ...s.telemetryLatest, [id]: latestForDevice },
        telemetryHistory: { ...s.telemetryHistory, [id]: historyForDevice },
      };
    });
  },

  addRuntime: (id, seconds) => set((s) => ({ runtimeTodaySec: { ...s.runtimeTodaySec, [id]: (s.runtimeTodaySec[id] ?? 0) + seconds } })),

  connectivityFor: (id) => {
    const hb = get().heartbeats[id];
    if (!hb?.lastHeartbeatAt) return connectivityFromAge(null);
    const ageSec = (Date.now() - new Date(hb.lastHeartbeatAt).getTime()) / 1000;
    return connectivityFromAge(ageSec);
  },
}));

// Maintenance-state derivation needs the equipment record; kept as a pure function (not a store
// method) since it doesn't depend on any other store's internal state — the caller supplies
// "now" implicitly via Date.now().
export function maintenanceStateFor(eq: EquipmentRecord, lastCompletedAt?: string): MaintenanceState {
  const intervalDays = eq.compliance.preventiveMaintenanceIntervalDays;
  if (!intervalDays) return "Not Due";
  const anchor = lastCompletedAt ?? eq.lifecycle.installationDate ?? eq.createdAt;
  const dueAt = new Date(anchor).getTime() + intervalDays * 86400000;
  const daysUntilDue = (dueAt - Date.now()) / 86400000;
  if (daysUntilDue < 0) return "Overdue";
  if (daysUntilDue <= 14) return "Due Soon";
  return "Not Due";
}

// Safety-state derivation combines this store's telemetry with the events store's open alarms —
// kept as a pure function so either store can call it without a circular subscription.
export function safetyStateFor(telemetryForDevice: Record<string, TelemetryReading> | undefined, openAlarms: EquipmentAlarm[]): SafetyState {
  if (openAlarms.some((a) => a.severity === "Critical" || a.severity === "Emergency")) return "Critical";
  const readings = Object.values(telemetryForDevice ?? {});
  if (readings.some((r) => r.severity === "Critical")) return "Critical";
  if (readings.some((r) => r.severity === "Warning") || openAlarms.some((a) => a.severity === "High" || a.severity === "Medium")) return "Warning";
  return "Normal";
}

export function statusFor(
  eq: EquipmentRecord,
  machine: MachineState,
  connectivity: ReturnType<typeof connectivityFromAge>,
  maintenance: MaintenanceState,
  safety: SafetyState,
): EquipmentStatus {
  return { machine, connectivity, maintenance, safety };
}
