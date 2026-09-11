import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Activity, Wifi, BellRing, WifiOff, Skull, ListChecks } from "lucide-react";
import { PageHeader, StatCard, Card, EmptyState } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion/Reveal";
import { useEquipment, maintenanceStateFor, safetyStateFor } from "@/store/useEquipment";
import { useEquipmentEvents } from "@/store/useEquipmentEvents";
import { startEquipmentSimulator } from "@/lib/equipmentSimulator";
import { MachineStateBadge, ConnectivityBadge, MaintenanceStateBadge, SafetyStateBadge, AlarmSeverityBadge } from "@/components/equipment/EquipmentStatusBadge";
import { IntegrationBadge } from "@/components/equipment/IntegrationBadge";
import { timeAgo } from "@/lib/format";

export default function CommandCentre() {
  const store = useEquipment();
  const events = useEquipmentEvents();

  useEffect(() => {
    startEquipmentSimulator();
  }, []);

  const rows = store.equipment.map((eq) => {
    const machine = store.machineStates[eq.id] ?? "Unknown";
    const connectivity = store.connectivityFor(eq.id);
    const maintenance = maintenanceStateFor(eq);
    const openAlarms = events.openAlarmsFor(eq.id);
    const safety = safetyStateFor(store.telemetryLatest[eq.id], openAlarms);
    return { eq, machine, connectivity, maintenance, safety, openAlarms };
  });

  const online = rows.filter((r) => r.connectivity === "Online").length;
  const running = rows.filter((r) => r.machine === "Running").length;
  const offline = rows.filter((r) => r.connectivity === "Offline").length;
  const critical = rows.filter((r) => r.safety === "Critical").length;
  const activeAlarms = events.alarms.filter((a) => !["Resolved", "Closed", "Suppressed"].includes(a.status));

  return (
    <div>
      <PageHeader
        title="Equipment SCADA Command Centre"
        subtitle="Live medical device and facility infrastructure monitoring — simulated telemetry, real alarm/audit trail"
        actions={<Link to="/equipment-scada/register" className="btn-soft px-3 py-1.5 text-xs">Equipment Register →</Link>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Online" value={online} tone="brand" icon={<Wifi size={18} />} />
        <StatCard label="Running" value={running} tone="brand" delay={0.05} icon={<Activity size={18} />} />
        <StatCard label="Active Alarms" value={activeAlarms.length} tone={activeAlarms.length ? "amber" : "mist"} delay={0.1} icon={<BellRing size={18} />} />
        <StatCard label="Offline" value={offline} tone={offline ? "action" : "mist"} delay={0.15} icon={<WifiOff size={18} />} />
        <StatCard label="Critical" value={critical} tone={critical ? "action" : "brand"} delay={0.2} icon={<Skull size={18} />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <h3 className="mb-3 font-display font-bold text-mist-900">Live Equipment Status</h3>
          <div className="space-y-2">
            {rows.map(({ eq, machine, connectivity, maintenance, safety, openAlarms }, i) => (
              <Reveal key={eq.id} delay={i * 0.03}>
                <Link
                  to={`/equipment-scada/register/${eq.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 ring-1 ring-mist-100 transition hover:bg-mist-50"
                >
                  <div className="min-w-[180px]">
                    <p className="font-semibold text-mist-900">{eq.name}</p>
                    <p className="text-[11px] text-mist-400">{eq.equipmentId} · {eq.location.department}{eq.location.room ? ` · ${eq.location.room}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <MachineStateBadge state={machine} />
                    <ConnectivityBadge state={connectivity} />
                    {safety !== "Normal" && <SafetyStateBadge state={safety} />}
                    {maintenance !== "Not Due" && <MaintenanceStateBadge state={maintenance} />}
                    {openAlarms.length > 0 && (
                      <span className="chip gap-1 bg-action-50 text-action-700 ring-1 ring-action-200">
                        <BellRing size={11} aria-hidden /> {openAlarms.length}
                      </span>
                    )}
                    <IntegrationBadge kind={eq.technical.integrationKind} />
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-mist-900"><BellRing size={16} /> Active Alarm Centre</h3>
          {activeAlarms.length === 0 ? (
            <EmptyState title="No active alarms" hint="All monitored equipment is within normal parameters." />
          ) : (
            <div className="space-y-2">
              {activeAlarms.slice(0, 12).map((alarm) => {
                const eq = store.equipmentById(alarm.equipmentId);
                return (
                  <Link key={alarm.id} to={`/equipment-scada/register/${alarm.equipmentId}`} className="block rounded-xl px-3 py-2 ring-1 ring-mist-100 hover:bg-mist-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-mist-800">{eq?.name ?? alarm.equipmentId}</span>
                      <AlarmSeverityBadge severity={alarm.severity} />
                    </div>
                    <p className="mt-1 text-[11px] text-mist-500">{alarm.description}</p>
                    <p className="text-[10px] text-mist-300">{timeAgo(alarm.raisedAt)} · {alarm.category}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-mist-900"><ListChecks size={16} /> Recent Events</h3>
        {events.timeline.length === 0 ? (
          <EmptyState title="No events yet" hint="Events appear here as simulated devices power on, run, and report activity." />
        ) : (
          <div className="max-h-72 space-y-1.5 overflow-y-auto text-xs">
            {events.timeline.slice(0, 40).map((event) => {
              const eq = store.equipmentById(event.equipmentId);
              return (
                <div key={event.id} className="flex items-center justify-between gap-2 border-b border-mist-100 py-1.5 last:border-0">
                  <span className="text-mist-600">
                    <span className="font-semibold text-mist-800">{eq?.name ?? event.equipmentId}</span> · {event.type.replace(/_/g, " ")}
                    {event.detail ? ` — ${event.detail}` : ""}
                  </span>
                  <span className="shrink-0 text-mist-300">{timeAgo(event.at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
