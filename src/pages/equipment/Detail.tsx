import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Wrench, RotateCcw, TriangleAlert } from "lucide-react";
import { PageHeader, Card, Button, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Lines } from "@/components/ui/Chart";
import { useEquipment, maintenanceStateFor, safetyStateFor } from "@/store/useEquipment";
import { useEquipmentEvents } from "@/store/useEquipmentEvents";
import { startEquipmentSimulator, triggerScenario, type SimulatorScenario } from "@/lib/equipmentSimulator";
import { TELEMETRY_PARAMS } from "@/data/equipmentTelemetry";
import {
  MachineStateBadge, ConnectivityBadge, MaintenanceStateBadge, SafetyStateBadge, AlarmSeverityBadge, AlarmLifecycleBadge,
} from "@/components/equipment/EquipmentStatusBadge";
import { IntegrationBadge } from "@/components/equipment/IntegrationBadge";
import { shortDate, dateTime, timeAgo } from "@/lib/format";

const SCENARIOS: SimulatorScenario[] = ["Normal", "Device Error", "Over-Threshold", "Connectivity Loss", "Maintenance", "Calibration"];

export default function EquipmentDetail() {
  const { id } = useParams();
  const store = useEquipment();
  const events = useEquipmentEvents();
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");

  useEffect(() => {
    startEquipmentSimulator();
  }, []);

  const eq = id ? store.equipmentById(id) : undefined;
  if (!eq) {
    return (
      <div>
        <PageHeader title="Equipment not found" />
        <EmptyState title="No such equipment" hint="It may have been removed, or the link is out of date." />
        <Link to="/equipment-scada/register" className="btn-soft mt-3 inline-flex px-3 py-1.5 text-xs">← Back to register</Link>
      </div>
    );
  }

  const machine = store.machineStates[eq.id] ?? "Unknown";
  const connectivity = store.connectivityFor(eq.id);
  const maintenance = maintenanceStateFor(eq);
  const openAlarms = events.openAlarmsFor(eq.id);
  const safety = safetyStateFor(store.telemetryLatest[eq.id], openAlarms);
  const heartbeat = store.heartbeats[eq.id];
  const params = TELEMETRY_PARAMS[eq.category] ?? [];
  const timeline = events.timelineFor(eq.id);
  const alarms = events.alarmsFor(eq.id);

  return (
    <div>
      <Link to="/equipment-scada/register" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-mist-500 hover:text-mist-700">
        <ArrowLeft size={13} /> Equipment Register
      </Link>
      <PageHeader
        title={eq.name}
        subtitle={`${eq.equipmentId} · ${eq.manufacturer} ${eq.model} · S/N ${eq.serialNumber}`}
        actions={<IntegrationBadge kind={eq.technical.integrationKind} />}
      />

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <MachineStateBadge state={machine} />
        <ConnectivityBadge state={connectivity} />
        <SafetyStateBadge state={safety} />
        <MaintenanceStateBadge state={maintenance} />
      </div>

      <Tabs tabs={["Overview", "Live", "Telemetry", `Timeline (${timeline.length})`, `Alarms (${alarms.length})`]}>
        {(tab) =>
          tab === "Overview" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <h3 className="mb-3 font-display font-bold text-mist-900">Identification & Location</h3>
                <dl className="space-y-1.5 text-sm">
                  <Row2 k="Category" v={eq.category} />
                  <Row2 k="Ownership" v={eq.ownership} />
                  <Row2 k="Building" v={eq.location.building} />
                  <Row2 k="Department" v={eq.location.department} />
                  {eq.location.room && <Row2 k="Room" v={eq.location.room} />}
                  {eq.location.ward && <Row2 k="Ward" v={eq.location.ward} />}
                </dl>
              </Card>
              <Card>
                <h3 className="mb-3 font-display font-bold text-mist-900">Lifecycle</h3>
                <dl className="space-y-1.5 text-sm">
                  {eq.lifecycle.installationDate && <Row2 k="Installed" v={shortDate(eq.lifecycle.installationDate)} />}
                  {eq.lifecycle.warrantyEnd && <Row2 k="Warranty ends" v={shortDate(eq.lifecycle.warrantyEnd)} />}
                  {eq.lifecycle.expectedLifespanYears && <Row2 k="Expected lifespan" v={`${eq.lifecycle.expectedLifespanYears} years`} />}
                  {eq.compliance.calibrationRequired && eq.compliance.calibrationIntervalDays && (
                    <Row2 k="Calibration interval" v={`${eq.compliance.calibrationIntervalDays} days`} />
                  )}
                  {eq.compliance.preventiveMaintenanceIntervalDays && (
                    <Row2 k="PM interval" v={`${eq.compliance.preventiveMaintenanceIntervalDays} days`} />
                  )}
                  <Row2 k="Registered by" v={eq.registeredBy} />
                </dl>
              </Card>
            </div>
          ) : tab === "Live" ? (
            <div className="space-y-4">
              <Card>
                <h3 className="mb-3 font-display font-bold text-mist-900">Connectivity</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <Row2 k="Last heartbeat" v={heartbeat?.lastHeartbeatAt ? timeAgo(heartbeat.lastHeartbeatAt) : "Never"} />
                  <Row2 k="Latency" v={heartbeat?.latencyMs ? `${Math.round(heartbeat.latencyMs)} ms` : "—"} />
                  <Row2 k="Consecutive failures" v={String(heartbeat?.consecutiveFailures ?? 0)} />
                  <Row2 k="Connection attempts" v={String(heartbeat?.connectionAttempts ?? 0)} />
                </dl>
              </Card>
              {eq.technical.integrationKind === "SIMULATOR" && (
                <Card>
                  <h3 className="mb-2 flex items-center gap-2 font-display font-bold text-mist-900"><Wrench size={16} /> Simulator Scenario</h3>
                  <p className="mb-3 text-xs text-mist-400">
                    Demo control for this simulated device — triggers realistic telemetry/event sequences. No physical equipment is affected.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SCENARIOS.map((s) => (
                      <button key={s} onClick={() => triggerScenario(eq.id, s)} className="chip bg-white text-mist-600 ring-1 ring-mist-200 hover:bg-mist-50">
                        {s}
                      </button>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          ) : tab === "Telemetry" ? (
            params.length === 0 ? (
              <EmptyState title="No telemetry parameters defined" hint="This equipment category has no configured telemetry set." />
            ) : (
              <div className="space-y-4">
                {params.map((def) => {
                  const history = store.telemetryHistory[eq.id]?.[def.key] ?? [];
                  const latest = store.telemetryLatest[eq.id]?.[def.key];
                  return (
                    <Card key={def.key}>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="font-semibold text-mist-800">{def.label}</h4>
                        <span className="text-sm font-mono text-mist-600">
                          {latest ? `${latest.value.toFixed(1)} ${def.unit}` : "No data yet"}
                        </span>
                      </div>
                      {history.length < 2 ? (
                        <p className="py-6 text-center text-xs text-mist-400">Not enough readings yet to chart a trend.</p>
                      ) : (
                        <Lines
                          data={history.map((h) => ({ t: dateTime(h.at).slice(-5), value: h.value }))}
                          x="t"
                          series={[{ key: "value", label: def.label, color: "#0fc06d" }]}
                          referenceBand={{ from: def.normalMin, to: def.normalMax }}
                          height={160}
                        />
                      )}
                    </Card>
                  );
                })}
              </div>
            )
          ) : tab.startsWith("Timeline") ? (
            <Table columns={["Time", "Event", "Source", "Detail"]} caption="Equipment timeline">
              {timeline.length === 0 && <EmptyRow colSpan={4}>No events recorded yet.</EmptyRow>}
              {timeline.map((event, i) => (
                <Row key={event.id} index={i}>
                  <Cell className="whitespace-nowrap text-xs text-mist-500">{dateTime(event.at)}</Cell>
                  <Cell className="font-semibold">{event.type.replace(/_/g, " ")}</Cell>
                  <Cell><span className="text-xs text-mist-500">{event.source}{event.actor ? ` · ${event.actor}` : ""}</span></Cell>
                  <Cell className="text-mist-500">{event.detail ?? "—"}</Cell>
                </Row>
              ))}
            </Table>
          ) : (
            <div className="space-y-2">
              {alarms.length === 0 ? (
                <EmptyState title="No alarms recorded" hint="This device has not raised any alarms." />
              ) : (
                alarms.map((alarm) => (
                  <Card key={alarm.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlarmSeverityBadge severity={alarm.severity} />
                        <AlarmLifecycleBadge status={alarm.status} />
                        <span className="text-xs text-mist-400">{alarm.category}</span>
                      </div>
                      <span className="text-[11px] text-mist-300">{dateTime(alarm.raisedAt)}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-mist-700">{alarm.description}</p>
                    {alarm.resolution && <p className="mt-1 text-xs text-mist-400">Resolution: {alarm.resolution} — {alarm.resolvedBy}, {alarm.resolvedAt ? dateTime(alarm.resolvedAt) : ""}</p>}
                    {!["Resolved", "Closed", "Suppressed"].includes(alarm.status) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {alarm.status === "Raised" && (
                          <button onClick={() => events.acknowledgeAlarm(alarm.id)} className="btn-soft px-2.5 py-1 text-xs">Acknowledge</button>
                        )}
                        {(alarm.status === "Acknowledged" || alarm.status === "Investigating") && (
                          <button onClick={() => events.escalateAlarm(alarm.id, "Biomedical Engineering")} className="btn-soft px-2.5 py-1 text-xs">Escalate</button>
                        )}
                        <button onClick={() => { setResolveId(alarm.id); setResolution(""); }} className="btn-primary px-2.5 py-1 text-xs">Resolve</button>
                        <button onClick={() => events.suppressAlarm(alarm.id)} className="btn-ghost px-2.5 py-1 text-xs">Suppress</button>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          )
        }
      </Tabs>

      {resolveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <Card className="w-full max-w-md">
            <h3 className="mb-2 flex items-center gap-2 font-display font-bold text-mist-900"><TriangleAlert size={16} /> Resolve Alarm</h3>
            <textarea
              className="input min-h-[90px] w-full"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="What was done to resolve this alarm?"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setResolveId(null)}>Cancel</Button>
              <Button disabled={!resolution.trim()} onClick={() => { events.resolveAlarm(resolveId, resolution.trim()); setResolveId(null); }}>
                <RotateCcw size={14} /> Resolve
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row2({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-mist-400">{k}</dt>
      <dd className="font-semibold text-mist-800">{v}</dd>
    </div>
  );
}
