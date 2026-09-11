import type { ReactNode } from "react";
import { TrendingUp, TrendingDown, ShieldCheck, Activity } from "lucide-react";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { useEquipmentMaintenance } from "@/store/useEquipmentMaintenance";
import { reliabilityStatsFor, formatHours } from "@/lib/equipmentReliability";
import type { EquipmentRecord } from "@/data/equipment";
import { shortDate } from "@/lib/format";
import { Row2 } from "./shared";

export function AnalyticsTab({ eq }: { eq: EquipmentRecord }) {
  const maint = useEquipmentMaintenance();
  const workOrders = maint.workOrdersFor(eq.id);
  const reliability = reliabilityStatsFor(eq, workOrders);

  return (
    <div className="space-y-4">
      <p className="text-xs text-mist-400">
        Computed from completed corrective/emergency work orders for this equipment — never estimated or invented.
        {reliability.recordedDowntimeCount < reliability.failureCount &&
          ` ${reliability.failureCount - reliability.recordedDowntimeCount} of ${reliability.failureCount} failure(s) have no downtime recorded, so MTTR/availability use only the ${reliability.recordedDowntimeCount} that do.`}
      </p>

      {reliability.failureCount === 0 ? (
        <EmptyState
          title="Not enough history yet"
          hint="MTBF, MTTR, availability and failure rate need at least one completed corrective or emergency work order for this equipment."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ReliabilityStat icon={<TrendingUp size={16} />} label="MTBF" value={formatHours(reliability.mtbfHours!)} hint="Mean time between failures" />
          <ReliabilityStat
            icon={<TrendingDown size={16} />}
            label="MTTR"
            value={reliability.mttrHours !== null ? formatHours(reliability.mttrHours) : "No downtime recorded"}
            hint="Mean time to repair"
          />
          <ReliabilityStat
            icon={<ShieldCheck size={16} />}
            label="Availability"
            value={reliability.availabilityPct !== null ? `${reliability.availabilityPct.toFixed(2)}%` : "—"}
            hint="Uptime over the observation period"
          />
          <ReliabilityStat
            icon={<Activity size={16} />}
            label="Failure Rate"
            value={reliability.failureRatePer30Days !== null ? `${reliability.failureRatePer30Days.toFixed(2)} / 30d` : "—"}
            hint="Failures per 30 days"
          />
        </div>
      )}

      <Card>
        <h3 className="mb-3 font-display font-bold text-mist-900">Observation Period</h3>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <Row2 k="Since" v={eq.lifecycle.installationDate ? shortDate(eq.lifecycle.installationDate) : shortDate(eq.createdAt)} />
          <Row2 k="Duration tracked" v={formatHours(reliability.observationHours)} />
          <Row2 k="Completed failures" v={String(reliability.failureCount)} />
          <Row2 k="Total downtime" v={reliability.recordedDowntimeCount > 0 ? formatHours(reliability.totalDowntimeHours) : "Not recorded"} />
        </dl>
      </Card>

      {reliability.failures.length > 0 && (
        <Table columns={["Reported", "Type", "Description", "Downtime", "Root Cause"]} caption="Completed failures used in this calculation">
          {reliability.failures.map((wo, i) => (
            <Row key={wo.id} index={i}>
              <Cell className="whitespace-nowrap text-xs text-mist-500">{shortDate(wo.reportedAt)}</Cell>
              <Cell><Badge tone={wo.type === "Emergency" ? "action" : "amber"}>{wo.type}</Badge></Cell>
              <Cell className="max-w-[220px] truncate">{wo.description}</Cell>
              <Cell>{typeof wo.downtimeMinutes === "number" ? `${wo.downtimeMinutes} min` : "—"}</Cell>
              <Cell className="text-mist-500">{wo.diagnosis ?? "—"}</Cell>
            </Row>
          ))}
        </Table>
      )}
    </div>
  );
}

function ReliabilityStat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-mist-400">{icon}<span className="text-xs font-semibold uppercase tracking-wide">{label}</span></div>
      <p className="mt-1 text-xl font-bold text-mist-900">{value}</p>
      <p className="text-[11px] text-mist-400">{hint}</p>
    </Card>
  );
}
