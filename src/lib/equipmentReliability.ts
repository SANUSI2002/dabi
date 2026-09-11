import type { EquipmentRecord } from "@/data/equipment";
import type { WorkOrder } from "@/data/equipmentMaintenance";

// Reliability analytics computed from real completed work orders — never a fabricated figure.
// MTBF/MTTR/availability/failure rate are all null (not a fake 0) when there isn't yet enough
// history to compute them honestly, per the same rule this project has enforced everywhere else.
export type ReliabilityStats = {
  failureCount: number;
  totalDowntimeHours: number;
  recordedDowntimeCount: number;
  observationHours: number;
  mtbfHours: number | null;
  mttrHours: number | null;
  availabilityPct: number | null;
  failureRatePer30Days: number | null;
  failures: WorkOrder[];
};

export function reliabilityStatsFor(eq: EquipmentRecord, workOrdersForEquipment: WorkOrder[]): ReliabilityStats {
  const failures = workOrdersForEquipment
    .filter((w) => (w.type === "Corrective" || w.type === "Emergency") && w.status === "Completed")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  const failureCount = failures.length;
  const withDowntime = failures.filter((w) => typeof w.downtimeMinutes === "number");
  const recordedDowntimeCount = withDowntime.length;
  const totalDowntimeMinutes = withDowntime.reduce((n, w) => n + (w.downtimeMinutes ?? 0), 0);
  const totalDowntimeHours = totalDowntimeMinutes / 60;

  const observationStart = eq.lifecycle.installationDate ?? eq.createdAt;
  const observationHours = Math.max(1, (Date.now() - new Date(observationStart).getTime()) / 3600000);
  const uptimeHours = Math.max(0, observationHours - totalDowntimeHours);

  const mtbfHours = failureCount > 0 ? uptimeHours / failureCount : null;
  const mttrHours = recordedDowntimeCount > 0 ? totalDowntimeHours / recordedDowntimeCount : null;
  const availabilityPct = recordedDowntimeCount > 0 ? (uptimeHours / observationHours) * 100 : null;
  const failureRatePer30Days = failureCount > 0 ? (failureCount / observationHours) * 24 * 30 : null;

  return { failureCount, totalDowntimeHours, recordedDowntimeCount, observationHours, mtbfHours, mttrHours, availabilityPct, failureRatePer30Days, failures };
}

export function formatHours(hours: number): string {
  if (hours >= 24) return `${(hours / 24).toFixed(hours / 24 >= 10 ? 0 : 1)} days`;
  return `${hours.toFixed(1)} hrs`;
}
