// Equipment state is deliberately split into four independent axes, per the directive: a device
// losing its network link is a connectivity fact, not proof the physical machine powered off.
// Machine state is derived from telemetry/events, not hand-edited, once a device has any event
// history — see useEquipment.ts's deriveMachineState().

export type MachineState =
  | "Unknown" | "Offline" | "Powered Off" | "Starting" | "Ready" | "Idle"
  | "Running" | "Warning" | "Error" | "Critical" | "Maintenance" | "Calibration" | "Decommissioned";

export type ConnectivityState = "Online" | "Degraded" | "Stale" | "Offline" | "Unknown";

export type MaintenanceState = "Not Due" | "Due Soon" | "Overdue" | "In Progress";

export type SafetyState = "Normal" | "Warning" | "Critical";

export type EquipmentStatus = {
  machine: MachineState;
  connectivity: ConnectivityState;
  maintenance: MaintenanceState;
  safety: SafetyState;
};

// Centralized heartbeat thresholds — never hard-code these ages inline in a component.
export const HEARTBEAT_THRESHOLDS = {
  onlineMaxSec: 30,
  degradedMaxSec: 60,
  staleMaxSec: 120,
} as const;

export function connectivityFromAge(ageSec: number | null): ConnectivityState {
  if (ageSec === null) return "Unknown";
  if (ageSec <= HEARTBEAT_THRESHOLDS.onlineMaxSec) return "Online";
  if (ageSec <= HEARTBEAT_THRESHOLDS.degradedMaxSec) return "Degraded";
  if (ageSec <= HEARTBEAT_THRESHOLDS.staleMaxSec) return "Stale";
  return "Offline";
}

export type Heartbeat = {
  lastHeartbeatAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  connectionAttempts: number;
  latencyMs: number | null;
};

export function emptyHeartbeat(): Heartbeat {
  return { lastHeartbeatAt: null, lastSuccessAt: null, lastFailureAt: null, consecutiveFailures: 0, connectionAttempts: 0, latencyMs: null };
}
