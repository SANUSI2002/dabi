import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, AlertTriangle } from "lucide-react";
import { PageHeader, StatCard, Card, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { useEquipment } from "@/store/useEquipment";
import { useEquipmentMaintenance } from "@/store/useEquipmentMaintenance";
import { startEquipmentSimulator } from "@/lib/equipmentSimulator";
import { reliabilityStatsFor, formatHours } from "@/lib/equipmentReliability";

export default function EquipmentAnalytics() {
  const store = useEquipment();
  const maint = useEquipmentMaintenance();

  useEffect(() => {
    startEquipmentSimulator();
  }, []);

  const rows = store.equipment.map((eq) => ({ eq, stats: reliabilityStatsFor(eq, maint.workOrdersFor(eq.id)) }));
  const withHistory = rows.filter((r) => r.stats.failureCount > 0);
  const withAvailability = withHistory.filter((r) => r.stats.availabilityPct !== null);
  const totalFailures = rows.reduce((n, r) => n + r.stats.failureCount, 0);
  const avgAvailability = withAvailability.length
    ? withAvailability.reduce((n, r) => n + r.stats.availabilityPct!, 0) / withAvailability.length
    : null;
  const worst = [...withAvailability].sort((a, b) => a.stats.availabilityPct! - b.stats.availabilityPct!)[0];

  const sorted = [...rows].sort((a, b) => {
    if (a.stats.availabilityPct !== null && b.stats.availabilityPct !== null) return a.stats.availabilityPct - b.stats.availabilityPct;
    if (a.stats.availabilityPct !== null) return -1;
    if (b.stats.availabilityPct !== null) return 1;
    return b.stats.failureCount - a.stats.failureCount;
  });

  return (
    <div>
      <Link to="/equipment-scada" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-mist-500 hover:text-mist-700">
        <ArrowLeft size={13} /> SCADA Command Centre
      </Link>
      <PageHeader
        title="Equipment Reliability Analytics"
        subtitle="Fleet-wide MTBF, MTTR, availability and failure rate — computed from completed work orders, never estimated"
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Failures" value={totalFailures} tone={totalFailures ? "amber" : "brand"} icon={<AlertTriangle size={18} />} />
        <StatCard label="Equipment With History" value={`${withHistory.length}/${rows.length}`} tone="mist" delay={0.05} />
        <StatCard label="Fleet Avg Availability" value={avgAvailability !== null ? `${avgAvailability.toFixed(1)}%` : "No data yet"} tone="brand" delay={0.1} icon={<ShieldCheck size={18} />} />
        <StatCard label="Worst Performer" value={worst ? worst.eq.name : "No data yet"} tone={worst ? "action" : "mist"} delay={0.15} />
      </div>

      {rows.every((r) => r.stats.failureCount === 0) ? (
        <EmptyState
          title="No completed failures across the fleet yet"
          hint="Report a failure and complete its work order on any equipment's Maintenance tab to start building reliability history."
        />
      ) : (
        <Card className="p-0 overflow-x-auto">
          <Table columns={["Equipment", "Category", "Failures", "Downtime", "MTBF", "MTTR", "Availability", "Failure Rate"]} caption="Fleet reliability, worst availability first">
            {sorted.length === 0 && <EmptyRow colSpan={8}>No equipment registered.</EmptyRow>}
            {sorted.map(({ eq, stats }, i) => (
              <Row key={eq.id} index={i}>
                <Cell>
                  <Link to={`/equipment-scada/register/${eq.id}`} className="font-semibold text-mist-900 hover:underline">{eq.name}</Link>
                  <span className="block text-[11px] text-mist-400">{eq.equipmentId}</span>
                </Cell>
                <Cell>{eq.category}</Cell>
                <Cell>{stats.failureCount}</Cell>
                <Cell>{stats.recordedDowntimeCount > 0 ? formatHours(stats.totalDowntimeHours) : "—"}</Cell>
                <Cell>{stats.mtbfHours !== null ? formatHours(stats.mtbfHours) : "—"}</Cell>
                <Cell>{stats.mttrHours !== null ? formatHours(stats.mttrHours) : "—"}</Cell>
                <Cell className={stats.availabilityPct !== null && stats.availabilityPct < 95 ? "font-semibold text-action-600" : ""}>
                  {stats.availabilityPct !== null ? `${stats.availabilityPct.toFixed(2)}%` : "No history"}
                </Cell>
                <Cell>{stats.failureRatePer30Days !== null ? `${stats.failureRatePer30Days.toFixed(2)} / 30d` : "—"}</Cell>
              </Row>
            ))}
          </Table>
        </Card>
      )}

      <p className="mt-4 text-center text-[11px] text-mist-300">
        MTBF = uptime ÷ failures · MTTR = average recorded downtime per failure · Availability = uptime ÷ observation period.
        Equipment with zero completed corrective/emergency work orders shows "No history" rather than a fabricated 100%.
      </p>
    </div>
  );
}
