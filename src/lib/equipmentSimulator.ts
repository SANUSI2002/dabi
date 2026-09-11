// Equipment simulator engine. Everything here is explicitly SIMULATED — no code path here
// pretends to talk to a real device. It exists so the SCADA UI has realistic, moving telemetry
// and event sequences to demonstrate against, and so the analyzer -> real Lab Order integration
// can be proven end to end without a physical analyzer.
import { useEquipment, maintenanceStateFor, calibrationStateFor } from "@/store/useEquipment";
import { useEquipmentEvents } from "@/store/useEquipmentEvents";
import { useEquipmentMaintenance } from "@/store/useEquipmentMaintenance";
import { useEquipmentCalibration } from "@/store/useEquipmentCalibration";
import { useEquipmentUsage } from "@/store/useEquipmentUsage";
import { useEquipmentConsumables } from "@/store/useEquipmentConsumables";
import { useEquipmentWarranty } from "@/store/useEquipmentWarranty";
import { useEmr } from "@/store/useEmr";
import { useLabConfig } from "@/store/useLabConfig";
import { TELEMETRY_PARAMS, severityFor } from "@/data/equipmentTelemetry";
import { consumableStateFor } from "@/data/equipmentConsumables";
import { warrantyStatusFor } from "@/data/equipmentWarranty";
import type { EquipmentRecord } from "@/data/equipment";

export type SimulatorScenario = "Normal" | "Device Error" | "Over-Threshold" | "Connectivity Loss" | "Maintenance" | "Calibration";

const activeScenarios = new Map<string, SimulatorScenario>();
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let started = false;

// An analyzer run stays visibly "in use" for a couple of ticks (~10-15s) rather than starting
// and finishing within one synchronous tick — otherwise the SCADA grid could never actually show
// a machine mid-test, which defeats the point of surfacing who's using it.
type PendingRun = { orderId: string; sessionId: string; ticksRemaining: number };
const pendingRuns = new Map<string, PendingRun>();

export function triggerScenario(equipmentId: string, scenario: SimulatorScenario) {
  activeScenarios.set(equipmentId, scenario);
  const eq = useEquipment.getState().equipmentById(equipmentId);
  if (!eq) return;
  if (scenario === "Maintenance") {
    useEquipment.getState().setMachineState(equipmentId, "Maintenance");
    useEquipmentEvents.getState().logEvent({ equipmentId, type: "MAINTENANCE_STARTED", source: "USER", detail: "Started from Live Monitoring" });
  } else if (scenario === "Calibration") {
    useEquipment.getState().setMachineState(equipmentId, "Calibration");
    useEquipmentEvents.getState().logEvent({ equipmentId, type: "CALIBRATION_STARTED", source: "USER", detail: "Started from Live Monitoring" });
  } else if (scenario === "Normal") {
    useEquipment.getState().setMachineState(equipmentId, "Running");
    useEquipmentEvents.getState().logEvent({ equipmentId, type: "MAINTENANCE_COMPLETED", source: "USER", detail: "Scenario reset to Normal" });
  }
}

function jitter(min: number, max: number, prev: number | undefined, drift: number): number {
  const base = prev ?? (min + max) / 2;
  const step = (Math.random() - 0.5) * drift;
  return Math.min(max, Math.max(min, base + step));
}

function pushOutOfRangeValue(defMax: number, defCriticalMax?: number): number {
  return defCriticalMax ? defCriticalMax + Math.random() * (defCriticalMax - defMax) * 0.3 : defMax * 1.15;
}

function tickTelemetry(eq: EquipmentRecord) {
  const store = useEquipment.getState();
  const params = TELEMETRY_PARAMS[eq.category] ?? [];
  const scenario = activeScenarios.get(eq.id) ?? "Normal";
  const latest = store.telemetryLatest[eq.id] ?? {};

  for (const def of params) {
    let value: number;
    if (scenario === "Over-Threshold") {
      value = pushOutOfRangeValue(def.normalMax, def.criticalMax);
    } else {
      const prevValue = latest[def.key]?.value;
      value = jitter(def.normalMin, def.normalMax, prevValue, (def.normalMax - def.normalMin) * 0.08);
    }
    store.pushTelemetry(eq.id, def.key, value, eq.category);

    const severity = severityFor(def, value);
    const openForParam = useEquipmentEvents.getState().openAlarmsFor(eq.id).find((a) => a.parameter === def.key);
    if (severity !== "Normal" && !openForParam) {
      useEquipmentEvents.getState().raiseAlarm({
        equipmentId: eq.id,
        source: "SIMULATOR",
        severity: severity === "Critical" ? "Critical" : "Medium",
        category: "Threshold Breach",
        description: `${def.label} ${severity === "Critical" ? "critical" : "warning"}: ${value.toFixed(1)} ${def.unit}`,
        parameter: def.key,
        value,
        threshold: severity === "Critical" ? def.criticalMax ?? def.criticalMin : def.warningMax ?? def.warningMin,
      });
    }
  }
}

function tickHeartbeatAndState(eq: EquipmentRecord) {
  const store = useEquipment.getState();
  const scenario = activeScenarios.get(eq.id) ?? "Normal";
  const machine = store.machineStates[eq.id];

  if (machine === "Decommissioned" || machine === "Maintenance" || machine === "Calibration") return;

  if (scenario === "Connectivity Loss") {
    // Deliberately skip the heartbeat this tick — connectivity degrades purely from heartbeat
    // age, matching the rule that a dropped link is not the same fact as the machine powering off.
    return;
  }

  store.recordHeartbeat(eq.id, true, 20 + Math.random() * 60);

  if (machine === "Unknown" || machine === "Offline" || machine === "Powered Off") {
    store.setMachineState(eq.id, "Starting");
    useEquipmentEvents.getState().logEvent({ equipmentId: eq.id, type: "STARTING", source: "SIMULATOR" });
  } else if (machine === "Starting") {
    store.setMachineState(eq.id, "Ready");
    useEquipmentEvents.getState().logEvent({ equipmentId: eq.id, type: "READY", source: "SIMULATOR" });
  } else if (machine === "Ready") {
    store.setMachineState(eq.id, "Running");
    useEquipmentEvents.getState().logEvent({ equipmentId: eq.id, type: "POWER_ON", source: "SIMULATOR" });
  } else if (machine === "Running") {
    store.addRuntime(eq.id, 5);
    if (scenario === "Device Error") {
      store.setMachineState(eq.id, "Error");
      useEquipmentEvents.getState().logEvent({ equipmentId: eq.id, type: "ERROR", source: "SIMULATOR", detail: "Simulated device error" });
      useEquipmentEvents.getState().raiseAlarm({
        equipmentId: eq.id, source: "SIMULATOR", severity: "High", category: "Safety", description: "Device reported an internal error",
      });
    }
  } else if (machine === "Error") {
    // stays in Error until a technician resolves the open alarm and resets the scenario
  }
}

const ANALYZER_CATEGORY_MAP: Record<string, string> = {
  "EQ-LAB-0001": "Haematology",
  "EQ-LAB-0002": "Clinical Chemistry",
};

function generateResultFields(fields: { id: string; label: string; unit?: string; refRange?: string; type: string; options?: string[] }[]) {
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (f.type === "select" && f.options?.length) {
      out[f.id] = f.options[0];
    } else if (f.type === "number" || f.refRange) {
      const range = f.refRange?.match(/([\d.]+)\s*[–-]\s*([\d.]+)/);
      if (range) {
        const lo = parseFloat(range[1]);
        const hi = parseFloat(range[2]);
        out[f.id] = (lo + Math.random() * (hi - lo)).toFixed(1);
      } else {
        out[f.id] = (Math.random() * 10).toFixed(1);
      }
    } else {
      out[f.id] = "Within expected range (analyzer simulation)";
    }
  }
  return out;
}

// Real Lab integration: an analyzer that finds a matched, sample-collected lab order processes
// it through the *actual* useEmr lab pipeline — startProcessing -> advancePhase -> submitLabResult
// — so it lands in the real "Awaiting Approval" queue a lab scientist must sign off on, exactly
// like a manually entered result. Nothing here bypasses verification or writes a parallel record.
//
// The run is tied to a named operator — whoever actually collected the sample on the real order
// (falling back to who ordered it) — so the SCADA grid can show, live, whose test is occupying
// the machine, and the Usage tab keeps a traceable history of it afterward.
// Blocks the run and raises an alarm if this equipment has registered consumables but none of
// them are usable (expired or out of stock) — never lets a test silently proceed as if reagent
// were unlimited. Equipment with no consumables registered at all is untracked, not blocked.
function reserveConsumable(eq: EquipmentRecord, testName: string, orderId: string): boolean {
  const items = useEquipmentConsumables.getState().itemsFor(eq.id);
  if (items.length === 0) return true;

  const usable = items.find((i) => consumableStateFor(i) === "OK" || consumableStateFor(i) === "Low Stock");
  if (!usable) {
    const expired = items.some((i) => consumableStateFor(i) === "Expired");
    if (!useEquipmentEvents.getState().openAlarmsFor(eq.id).some((a) => a.category === "Consumable")) {
      useEquipmentEvents.getState().raiseAlarm({
        equipmentId: eq.id, source: "SIMULATOR", severity: "High", category: "Consumable",
        description: expired ? "All registered consumables are expired — testing blocked" : "Consumable stock depleted — testing blocked",
      });
    }
    return false;
  }
  useEquipmentConsumables.getState().consume(usable.id, 1, { reason: "Test", source: "SIMULATOR", testName, orderId });
  return true;
}

function startAnalyzerRun(eq: EquipmentRecord) {
  const wantedCategory = ANALYZER_CATEGORY_MAP[eq.equipmentId];
  if (!wantedCategory || pendingRuns.has(eq.id)) return;
  const emr = useEmr.getState();
  const candidate = emr.labOrders.find((o) => o.category === wantedCategory && o.status === "Sample Collected");
  if (!candidate) return;
  if (!reserveConsumable(eq, candidate.test, candidate.id)) return;

  const operator = candidate.sampleCollectedBy ?? candidate.orderedBy;
  const patient = emr.patientById(candidate.patientId);
  const patientName = patient ? `${patient.firstName} ${patient.lastName}` : undefined;
  const correlationId = candidate.id;

  useEquipmentEvents.getState().logEvent({
    equipmentId: eq.id, type: "TEST_STARTED", source: "SIMULATOR", actor: operator, detail: candidate.test,
    patientId: candidate.patientId, relatedOrderId: candidate.id, correlationId,
  });
  const session = useEquipmentUsage.getState().startSession(eq.id, { operator, patientId: candidate.patientId, patientName, testName: candidate.test, orderId: candidate.id });
  emr.startProcessing(candidate.id);
  pendingRuns.set(eq.id, { orderId: candidate.id, sessionId: session.id, ticksRemaining: 2 });
}

function finishAnalyzerRun(eq: EquipmentRecord, pending: PendingRun) {
  const emr = useEmr.getState();
  const candidate = emr.labOrders.find((o) => o.id === pending.orderId);
  pendingRuns.delete(eq.id);
  useEquipmentUsage.getState().endSession(pending.sessionId, candidate ? "Completed" : "Aborted");
  if (!candidate) return;

  const config = useLabConfig.getState().configFor(candidate.test);
  for (const phase of config.phases) emr.advancePhase(candidate.id, phase);
  const fields = generateResultFields(config.resultTemplate);
  emr.submitLabResult(candidate.id, fields, "Normal", config.phases[config.phases.length - 1]);

  const operator = candidate.sampleCollectedBy ?? candidate.orderedBy;
  const correlationId = candidate.id;
  useEquipmentEvents.getState().logEvent({
    equipmentId: eq.id, type: "TEST_COMPLETED", source: "SIMULATOR", actor: operator, detail: candidate.test,
    patientId: candidate.patientId, relatedOrderId: candidate.id, correlationId,
  });
  useEquipmentEvents.getState().logEvent({
    equipmentId: eq.id, type: "RESULT_GENERATED", source: "SIMULATOR", actor: operator, detail: `${candidate.test} result submitted for approval`,
    patientId: candidate.patientId, relatedOrderId: candidate.id, correlationId,
  });
}

function tick() {
  const equipment = useEquipment.getState().equipment.filter((e) => e.technical.integrationKind === "SIMULATOR");
  for (const eq of equipment) {
    tickHeartbeatAndState(eq);
    if (useEquipment.getState().machineStates[eq.id] === "Running") {
      tickTelemetry(eq);
      if (eq.category === "Laboratory Analyzer") {
        const pending = pendingRuns.get(eq.id);
        if (pending) {
          if (pending.ticksRemaining <= 1) finishAnalyzerRun(eq, pending);
          else pendingRuns.set(eq.id, { ...pending, ticksRemaining: pending.ticksRemaining - 1 });
        } else if (Math.random() < 0.3) {
          startAnalyzerRun(eq);
        }
      }
    }
    // Overdue preventive maintenance / calibration surfaces as a standing alarm rather than a
    // fabricated critical fault — it reflects a real schedule check against work order and
    // calibration history, not simulated telemetry.
    const lastPm = useEquipmentMaintenance.getState().lastPreventiveCompletedAt(eq.id);
    if (maintenanceStateFor(eq, lastPm) === "Overdue" && !useEquipmentEvents.getState().openAlarmsFor(eq.id).some((a) => a.category === "Maintenance")) {
      useEquipmentEvents.getState().raiseAlarm({
        equipmentId: eq.id, source: "SYSTEM", severity: "Medium", category: "Maintenance",
        description: "Preventive maintenance is overdue",
      });
    }
    const lastCal = useEquipmentCalibration.getState().lastCompletedFor(eq.id)?.performedAt;
    if (calibrationStateFor(eq, lastCal) === "Overdue" && !useEquipmentEvents.getState().openAlarmsFor(eq.id).some((a) => a.category === "Calibration")) {
      useEquipmentEvents.getState().raiseAlarm({
        equipmentId: eq.id, source: "SYSTEM", severity: "High", category: "Calibration",
        description: "Calibration is overdue",
      });
    }
    // Warranty expiry is a cost/coverage fact, not a safety one — surfaced once as a heads-up
    // ahead of the deadline (directive: "generate alerts before expiry"), not re-raised forever.
    const warranty = useEquipmentWarranty.getState().warrantyFor(eq.id);
    if (warrantyStatusFor(warranty) === "Expiring Soon" && !useEquipmentEvents.getState().openAlarmsFor(eq.id).some((a) => a.category === "Warranty")) {
      useEquipmentEvents.getState().raiseAlarm({
        equipmentId: eq.id, source: "SYSTEM", severity: "Low", category: "Warranty",
        description: `Warranty with ${warranty!.provider} expires ${new Date(warranty!.end).toLocaleDateString("en-GB")}`,
      });
    }
  }
}

export function startEquipmentSimulator() {
  if (started) return;
  started = true;
  intervalHandle = setInterval(tick, 5000);
  tick();
}

export function stopEquipmentSimulator() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  started = false;
  pendingRuns.clear();
}
