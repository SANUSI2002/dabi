import { useEffect, useState, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Wrench, RotateCcw, TriangleAlert, Plus, Trash2, Gauge, UserRound, Clock3, Activity, TrendingUp, TrendingDown, ShieldCheck, PackagePlus, Award, FileWarning } from "lucide-react";
import { PageHeader, Card, Button, Badge, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Checkbox, Textarea } from "@/components/ui/form";
import { Lines } from "@/components/ui/Chart";
import { useEquipment, maintenanceStateFor, calibrationStateFor, safetyStateFor } from "@/store/useEquipment";
import { useEquipmentEvents } from "@/store/useEquipmentEvents";
import { useEquipmentMaintenance } from "@/store/useEquipmentMaintenance";
import { useEquipmentCalibration } from "@/store/useEquipmentCalibration";
import { useEquipmentUsage } from "@/store/useEquipmentUsage";
import { useEquipmentConsumables } from "@/store/useEquipmentConsumables";
import { useEquipmentWarranty } from "@/store/useEquipmentWarranty";
import { startEquipmentSimulator, triggerScenario, type SimulatorScenario } from "@/lib/equipmentSimulator";
import { TELEMETRY_PARAMS } from "@/data/equipmentTelemetry";
import type { WorkOrder, WorkOrderSeverity } from "@/data/equipmentMaintenance";
import type { CalibrationRecord, CalibrationResult } from "@/data/equipmentCalibration";
import { consumableStateFor, type ConsumableItem } from "@/data/equipmentConsumables";
import { warrantyStatusFor, type WarrantyClaim, type WarrantyClaimStatus } from "@/data/equipmentWarranty";
import {
  MachineStateBadge, ConnectivityBadge, MaintenanceStateBadge, SafetyStateBadge, AlarmSeverityBadge, AlarmLifecycleBadge,
} from "@/components/equipment/EquipmentStatusBadge";
import { IntegrationBadge } from "@/components/equipment/IntegrationBadge";
import { reliabilityStatsFor, formatHours } from "@/lib/equipmentReliability";
import { shortDate, dateTime, timeAgo, isoDate } from "@/lib/format";

const SCENARIOS: SimulatorScenario[] = ["Normal", "Device Error", "Over-Threshold", "Connectivity Loss", "Maintenance", "Calibration"];
const SEVERITIES: WorkOrderSeverity[] = ["Low", "Medium", "High", "Critical"];

export default function EquipmentDetail() {
  const { id } = useParams();
  const store = useEquipment();
  const events = useEquipmentEvents();
  const maint = useEquipmentMaintenance();
  const cal = useEquipmentCalibration();
  const usage = useEquipmentUsage();
  const consumables = useEquipmentConsumables();
  const warranty = useEquipmentWarranty();
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");

  const [failureModal, setFailureModal] = useState(false);
  const [failureForm, setFailureForm] = useState({ description: "", severity: "Medium" as WorkOrderSeverity, failureCategory: "" });
  const [pmModal, setPmModal] = useState(false);
  const [pmForm, setPmForm] = useState({ scheduledFor: isoDate(new Date()), technician: "" });
  const [completeWoId, setCompleteWoId] = useState<string | null>(null);
  const [completeWoForm, setCompleteWoForm] = useState({ laborCost: "", downtimeMinutes: "", returnToServiceTested: false, returnToServiceNote: "" });
  const [partForm, setPartForm] = useState<Record<string, { name: string; qty: string; cost: string }>>({});

  const [calModal, setCalModal] = useState(false);
  const [calForm, setCalForm] = useState({ scheduledFor: isoDate(new Date()), vendor: "", technician: "" });
  const [completeCalId, setCompleteCalId] = useState<string | null>(null);
  const [completeCalForm, setCompleteCalForm] = useState({ result: "Pass" as CalibrationResult, certificateNumber: "", certificateExpiry: "", standardsUsed: "", notes: "" });

  const [registerConsumableModal, setRegisterConsumableModal] = useState(false);
  const [consumableForm, setConsumableForm] = useState({ name: "", lotNumber: "", expiryDate: isoDate(new Date()), unit: "unit", quantityOnHand: "0", reorderThreshold: "0", costPerUnit: "0", supplier: "" });
  const [receiveStockId, setReceiveStockId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState("0");
  const [wastageId, setWastageId] = useState<string | null>(null);
  const [wastageQty, setWastageQty] = useState("0");

  const [warrantyModal, setWarrantyModal] = useState(false);
  const [warrantyForm, setWarrantyForm] = useState({ provider: "", start: isoDate(new Date()), end: isoDate(new Date()), coverage: "", contactName: "", contactPhone: "", slaHours: "" });
  const [claimModal, setClaimModal] = useState(false);
  const [claimForm, setClaimForm] = useState({ issue: "", relatedWorkOrderId: "" });
  const [completeClaimId, setCompleteClaimId] = useState<string | null>(null);
  const [completeClaimForm, setCompleteClaimForm] = useState({ repairedUnderWarranty: true, costRecovered: "", resolutionNote: "" });

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
  const maintenance = maintenanceStateFor(eq, maint.lastPreventiveCompletedAt(eq.id));
  const calibration = calibrationStateFor(eq, cal.lastCompletedFor(eq.id)?.performedAt);
  const openAlarms = events.openAlarmsFor(eq.id);
  const safety = safetyStateFor(store.telemetryLatest[eq.id], openAlarms);
  const heartbeat = store.heartbeats[eq.id];
  const params = TELEMETRY_PARAMS[eq.category] ?? [];
  const timeline = events.timelineFor(eq.id);
  const alarms = events.alarmsFor(eq.id);
  const workOrders = maint.workOrdersFor(eq.id);
  const calRecords = cal.recordsFor(eq.id);
  const currentSession = usage.currentSessionFor(eq.id);
  const usageSessions = usage.sessionsFor(eq.id);
  const reliability = reliabilityStatsFor(eq, workOrders);
  const consumableItems = consumables.itemsFor(eq.id);
  const consumableUsage = consumables.usageFor(eq.id);
  const warrantyInfo = warranty.warrantyFor(eq.id);
  const warrantyState = warrantyStatusFor(warrantyInfo);
  const claims = warranty.claimsFor(eq.id);

  function partFormFor(woId: string) {
    return partForm[woId] ?? { name: "", qty: "1", cost: "0" };
  }

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
        {eq.compliance.calibrationRequired && <MaintenanceStateBadge state={calibration} />}
      </div>

      <Tabs
        tabs={[
          "Overview", "Live", "Telemetry", `Usage (${usageSessions.length})`, `Timeline (${timeline.length})`,
          `Alarms (${alarms.length})`, `Maintenance (${workOrders.length})`, `Calibration (${calRecords.length})`,
          `Consumables (${consumableItems.length})`, `Warranty (${claims.length})`, "Analytics",
        ]}
      >
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
              <Card className={currentSession ? "ring-1 ring-brand-200 bg-brand-50/40" : ""}>
                <h3 className="mb-2 flex items-center gap-2 font-display font-bold text-mist-900"><UserRound size={16} /> Current Activity</h3>
                {currentSession ? (
                  <div className="text-sm">
                    <p className="font-semibold text-mist-900">In use — {currentSession.operator}</p>
                    <p className="mt-0.5 text-mist-600">
                      {currentSession.testName ?? "Task in progress"}
                      {currentSession.patientName ? ` for ${currentSession.patientName}` : ""}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-mist-400"><Clock3 size={11} aria-hidden /> Started {timeAgo(currentSession.startedAt)}</p>
                  </div>
                ) : (
                  <p className="text-sm text-mist-400">No active test or task on this equipment right now.</p>
                )}
              </Card>
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
          ) : tab.startsWith("Usage") ? (
            <div>
              <p className="mb-3 text-xs text-mist-400">
                Who has used this equipment, for what, and when — derived from the real lab order each session is tied to, not a separate log.
              </p>
              <Table columns={["Operator", "Patient", "Test / Task", "Started", "Duration", "Outcome"]} caption="Equipment usage sessions">
                {usageSessions.length === 0 && <EmptyRow colSpan={6}>No usage sessions recorded yet.</EmptyRow>}
                {usageSessions.map((session, i) => {
                  const durationMin = session.endedAt
                    ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
                    : null;
                  return (
                    <Row key={session.id} index={i}>
                      <Cell className="font-semibold">{session.operator}</Cell>
                      <Cell>{session.patientName ?? "—"}</Cell>
                      <Cell>{session.testName ?? "—"}</Cell>
                      <Cell className="text-xs text-mist-500">{dateTime(session.startedAt)}</Cell>
                      <Cell>{durationMin !== null ? `${durationMin < 1 ? "<1" : durationMin} min` : "In progress"}</Cell>
                      <Cell>{session.outcome ? <Badge tone={session.outcome === "Completed" ? "brand" : "action"}>{session.outcome}</Badge> : <Badge tone="amber">Active</Badge>}</Cell>
                    </Row>
                  );
                })}
              </Table>
            </div>
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
          ) : tab.startsWith("Alarms") ? (
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
          ) : tab.startsWith("Maintenance") ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="action" onClick={() => { setFailureForm({ description: "", severity: "Medium", failureCategory: "" }); setFailureModal(true); }}>
                  <TriangleAlert size={14} /> Report Failure
                </Button>
                <Button variant="soft" onClick={() => { setPmForm({ scheduledFor: isoDate(new Date()), technician: "" }); setPmModal(true); }}>
                  <Wrench size={14} /> Schedule Preventive Maintenance
                </Button>
              </div>

              {workOrders.length === 0 ? (
                <EmptyState title="No work orders yet" hint="Report a failure or schedule preventive maintenance to start one." />
              ) : (
                <div className="space-y-3">
                  {workOrders.map((wo) => (
                    <WorkOrderCard
                      key={wo.id}
                      wo={wo}
                      onStart={() => maint.startWorkOrder(wo.id)}
                      onChecklist={(itemId, done) => maint.setChecklistItem(wo.id, itemId, done)}
                      onDiagnosis={(diagnosis, correctiveAction) => maint.recordDiagnosis(wo.id, diagnosis, correctiveAction)}
                      onAddPart={() => {
                        const f = partFormFor(wo.id);
                        if (!f.name.trim()) return;
                        maint.addPart(wo.id, { name: f.name.trim(), qty: +f.qty || 1, cost: +f.cost || 0 });
                        setPartForm((s) => ({ ...s, [wo.id]: { name: "", qty: "1", cost: "0" } }));
                      }}
                      onRemovePart={(i) => maint.removePart(wo.id, i)}
                      partForm={partFormFor(wo.id)}
                      onPartFormChange={(patch) => setPartForm((s) => ({ ...s, [wo.id]: { ...partFormFor(wo.id), ...patch } }))}
                      onComplete={() => { setCompleteWoId(wo.id); setCompleteWoForm({ laborCost: "", downtimeMinutes: "", returnToServiceTested: false, returnToServiceNote: "" }); }}
                      onCancel={() => maint.cancelWorkOrder(wo.id, "Cancelled from equipment detail")}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : tab.startsWith("Calibration") ? (
            <div className="space-y-4">
              <Button variant="soft" onClick={() => { setCalForm({ scheduledFor: isoDate(new Date()), vendor: "", technician: "" }); setCalModal(true); }}>
                <Gauge size={14} /> Schedule Calibration
              </Button>

              {calRecords.length === 0 ? (
                <EmptyState title="No calibration records yet" hint="Schedule a calibration to start tracking compliance for this device." />
              ) : (
                <div className="space-y-3">
                  {calRecords.map((record) => (
                    <CalibrationCard
                      key={record.id}
                      record={record}
                      onStart={() => cal.startCalibration(record.id)}
                      onComplete={() => { setCompleteCalId(record.id); setCompleteCalForm({ result: "Pass", certificateNumber: "", certificateExpiry: "", standardsUsed: "", notes: "" }); }}
                      onCancel={() => cal.cancelCalibration(record.id, "Cancelled from equipment detail")}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : tab.startsWith("Consumables") ? (
            <div className="space-y-4">
              <Button variant="soft" onClick={() => { setConsumableForm({ name: "", lotNumber: "", expiryDate: isoDate(new Date()), unit: "unit", quantityOnHand: "0", reorderThreshold: "0", costPerUnit: "0", supplier: "" }); setRegisterConsumableModal(true); }}>
                <PackagePlus size={14} /> Register Consumable
              </Button>

              {consumableItems.length === 0 ? (
                <EmptyState title="No consumables registered" hint="This equipment runs with no reagent/consumable gating until one is registered here." />
              ) : (
                <div className="space-y-3">
                  {consumableItems.map((item) => (
                    <ConsumableItemCard
                      key={item.id}
                      item={item}
                      onReceiveStock={() => { setReceiveStockId(item.id); setReceiveQty("0"); }}
                      onWastage={() => { setWastageId(item.id); setWastageQty("0"); }}
                    />
                  ))}
                </div>
              )}

              {consumableUsage.length > 0 && (
                <Table columns={["Date", "Item", "Qty", "Reason", "Source"]} caption="Consumable usage log">
                  {consumableUsage.map((event, i) => (
                    <Row key={event.id} index={i}>
                      <Cell className="whitespace-nowrap text-xs text-mist-500">{dateTime(event.at)}</Cell>
                      <Cell>{consumableItems.find((it) => it.id === event.consumableId)?.name ?? "—"}</Cell>
                      <Cell>{event.quantityUsed}</Cell>
                      <Cell>{event.reason}{event.testName ? ` · ${event.testName}` : ""}</Cell>
                      <Cell><Badge tone={event.source === "SIMULATOR" ? "mist" : "brand"}>{event.source}</Badge></Cell>
                    </Row>
                  ))}
                </Table>
              )}
            </div>
          ) : tab.startsWith("Warranty") ? (
            <div className="space-y-4">
              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-display font-bold text-mist-900"><Award size={16} /> Warranty Coverage</h3>
                  <MaintenanceStateBadge state={warrantyState === "Not Tracked" ? "Not Due" : warrantyState === "Active" ? "Not Due" : warrantyState === "Expiring Soon" ? "Due Soon" : "Overdue"} />
                </div>
                {warrantyInfo ? (
                  <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    <Row2 k="Provider" v={warrantyInfo.provider} />
                    <Row2 k="Coverage" v={warrantyInfo.coverage} />
                    <Row2 k="Start" v={shortDate(warrantyInfo.start)} />
                    <Row2 k="End" v={shortDate(warrantyInfo.end)} />
                    {warrantyInfo.contactName && <Row2 k="Contact" v={warrantyInfo.contactName} />}
                    {warrantyInfo.slaHours !== undefined && <Row2 k="Response SLA" v={`${warrantyInfo.slaHours}h`} />}
                  </dl>
                ) : (
                  <p className="text-sm text-mist-400">No warranty on file for this equipment.</p>
                )}
                <button
                  onClick={() => {
                    setWarrantyForm(
                      warrantyInfo
                        ? { provider: warrantyInfo.provider, start: isoDate(warrantyInfo.start), end: isoDate(warrantyInfo.end), coverage: warrantyInfo.coverage, contactName: warrantyInfo.contactName ?? "", contactPhone: warrantyInfo.contactPhone ?? "", slaHours: warrantyInfo.slaHours ? String(warrantyInfo.slaHours) : "" }
                        : { provider: "", start: isoDate(new Date()), end: isoDate(new Date()), coverage: "", contactName: "", contactPhone: "", slaHours: "" },
                    );
                    setWarrantyModal(true);
                  }}
                  className="btn-soft mt-3 px-2.5 py-1 text-xs"
                >
                  {warrantyInfo ? "Edit Warranty" : "Set Warranty"}
                </button>
              </Card>

              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-display font-bold text-mist-900"><FileWarning size={16} /> Claims</h3>
                <Button variant="soft" onClick={() => { setClaimForm({ issue: "", relatedWorkOrderId: "" }); setClaimModal(true); }}>File Claim</Button>
              </div>
              {claims.length === 0 ? (
                <EmptyState title="No warranty claims filed" hint="File a claim when a repair should be covered under warranty." />
              ) : (
                <div className="space-y-3">
                  {claims.map((claim) => (
                    <ClaimCard
                      key={claim.id}
                      claim={claim}
                      relatedWorkOrder={workOrders.find((w) => w.id === claim.relatedWorkOrderId)}
                      onApprove={() => warranty.updateClaimStatus(claim.id, "Approved")}
                      onReject={() => warranty.updateClaimStatus(claim.id, "Rejected", { resolutionNote: "Rejected by provider" })}
                      onStartRepair={() => warranty.updateClaimStatus(claim.id, "In Repair")}
                      onComplete={() => { setCompleteClaimId(claim.id); setCompleteClaimForm({ repairedUnderWarranty: true, costRecovered: "", resolutionNote: "" }); }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : tab === "Analytics" ? (
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
          ) : null
        }
      </Tabs>

      <Modal
        open={failureModal}
        onClose={() => setFailureModal(false)}
        title="Report Equipment Failure"
        footer={<><Button variant="ghost" onClick={() => setFailureModal(false)}>Cancel</Button>
          <Button disabled={!failureForm.description.trim()} onClick={() => { maint.reportFailure(eq.id, failureForm.description.trim(), failureForm.severity, failureForm.failureCategory || undefined); setFailureModal(false); }}>
            Create Work Order
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="What failed?"><Textarea value={failureForm.description} onChange={(e) => setFailureForm({ ...failureForm, description: e.target.value })} placeholder="Describe the fault…" /></Field>
          <Field label="Severity"><Select value={failureForm.severity} onChange={(e) => setFailureForm({ ...failureForm, severity: e.target.value as WorkOrderSeverity })} options={SEVERITIES} /></Field>
          <Field label="Failure category" hint="Optional"><Input value={failureForm.failureCategory} onChange={(e) => setFailureForm({ ...failureForm, failureCategory: e.target.value })} placeholder="e.g. Electrical, Mechanical, Sensor" /></Field>
          {failureForm.severity === "Critical" && <p className="rounded-xl bg-action-50 px-3 py-2 text-xs text-action-700">Critical severity creates an Emergency work order.</p>}
        </div>
      </Modal>

      <Modal
        open={pmModal}
        onClose={() => setPmModal(false)}
        title="Schedule Preventive Maintenance"
        footer={<><Button variant="ghost" onClick={() => setPmModal(false)}>Cancel</Button>
          <Button onClick={() => { maint.schedulePreventive(eq.id, new Date(pmForm.scheduledFor).toISOString(), pmForm.technician || undefined); setPmModal(false); }}>
            Schedule
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="Scheduled for"><Input type="date" value={pmForm.scheduledFor} onChange={(e) => setPmForm({ ...pmForm, scheduledFor: e.target.value })} /></Field>
          <Field label="Technician" hint="Optional"><Input value={pmForm.technician} onChange={(e) => setPmForm({ ...pmForm, technician: e.target.value })} /></Field>
        </div>
      </Modal>

      {completeWoId && (
        <Modal
          open
          onClose={() => setCompleteWoId(null)}
          title="Complete Work Order"
          footer={<><Button variant="ghost" onClick={() => setCompleteWoId(null)}>Cancel</Button>
            <Button
              disabled={!completeWoForm.returnToServiceTested}
              onClick={() => {
                maint.completeWorkOrder(completeWoId, {
                  laborCost: completeWoForm.laborCost ? +completeWoForm.laborCost : undefined,
                  downtimeMinutes: completeWoForm.downtimeMinutes ? +completeWoForm.downtimeMinutes : undefined,
                  returnToServiceTested: completeWoForm.returnToServiceTested,
                  returnToServiceNote: completeWoForm.returnToServiceNote || undefined,
                });
                setCompleteWoId(null);
              }}
            >
              Complete
            </Button></>}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Labor cost (₦)" hint="Optional"><Input type="number" value={completeWoForm.laborCost} onChange={(e) => setCompleteWoForm({ ...completeWoForm, laborCost: e.target.value })} /></Field>
              <Field label="Downtime (minutes)" hint="Optional"><Input type="number" value={completeWoForm.downtimeMinutes} onChange={(e) => setCompleteWoForm({ ...completeWoForm, downtimeMinutes: e.target.value })} /></Field>
            </div>
            <Checkbox
              label="Return-to-service test passed"
              checked={completeWoForm.returnToServiceTested}
              onChange={(e) => setCompleteWoForm({ ...completeWoForm, returnToServiceTested: e.target.checked })}
            />
            <Field label="Return-to-service note" hint="Optional"><Textarea value={completeWoForm.returnToServiceNote} onChange={(e) => setCompleteWoForm({ ...completeWoForm, returnToServiceNote: e.target.value })} /></Field>
            {!completeWoForm.returnToServiceTested && <p className="text-xs text-mist-400">A work order cannot be completed without a passed return-to-service test.</p>}
          </div>
        </Modal>
      )}

      <Modal
        open={calModal}
        onClose={() => setCalModal(false)}
        title="Schedule Calibration"
        footer={<><Button variant="ghost" onClick={() => setCalModal(false)}>Cancel</Button>
          <Button onClick={() => { cal.scheduleCalibration(eq.id, new Date(calForm.scheduledFor).toISOString(), calForm.vendor || undefined, calForm.technician || undefined); setCalModal(false); }}>
            Schedule
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="Scheduled for"><Input type="date" value={calForm.scheduledFor} onChange={(e) => setCalForm({ ...calForm, scheduledFor: e.target.value })} /></Field>
          <Field label="Vendor" hint="Optional"><Input value={calForm.vendor} onChange={(e) => setCalForm({ ...calForm, vendor: e.target.value })} /></Field>
          <Field label="Technician" hint="Optional"><Input value={calForm.technician} onChange={(e) => setCalForm({ ...calForm, technician: e.target.value })} /></Field>
        </div>
      </Modal>

      {completeCalId && (
        <Modal
          open
          onClose={() => setCompleteCalId(null)}
          title="Complete Calibration"
          footer={<><Button variant="ghost" onClick={() => setCompleteCalId(null)}>Cancel</Button>
            <Button
              onClick={() => {
                cal.completeCalibration(completeCalId, {
                  result: completeCalForm.result,
                  certificateNumber: completeCalForm.certificateNumber || undefined,
                  certificateExpiry: completeCalForm.certificateExpiry ? new Date(completeCalForm.certificateExpiry).toISOString() : undefined,
                  standardsUsed: completeCalForm.standardsUsed || undefined,
                  notes: completeCalForm.notes || undefined,
                });
                setCompleteCalId(null);
              }}
            >
              Complete
            </Button></>}
        >
          <div className="space-y-4">
            <Field label="Result"><Select value={completeCalForm.result} onChange={(e) => setCompleteCalForm({ ...completeCalForm, result: e.target.value as CalibrationResult })} options={["Pass", "Fail"]} /></Field>
            <Field label="Standards used" hint="Optional"><Input value={completeCalForm.standardsUsed} onChange={(e) => setCompleteCalForm({ ...completeCalForm, standardsUsed: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Certificate number" hint="Optional"><Input value={completeCalForm.certificateNumber} onChange={(e) => setCompleteCalForm({ ...completeCalForm, certificateNumber: e.target.value })} /></Field>
              <Field label="Certificate expiry" hint="Optional"><Input type="date" value={completeCalForm.certificateExpiry} onChange={(e) => setCompleteCalForm({ ...completeCalForm, certificateExpiry: e.target.value })} /></Field>
            </div>
            <Field label="Notes" hint="Optional"><Textarea value={completeCalForm.notes} onChange={(e) => setCompleteCalForm({ ...completeCalForm, notes: e.target.value })} /></Field>
          </div>
        </Modal>
      )}

      <Modal
        open={registerConsumableModal}
        onClose={() => setRegisterConsumableModal(false)}
        title="Register Consumable"
        footer={<><Button variant="ghost" onClick={() => setRegisterConsumableModal(false)}>Cancel</Button>
          <Button
            disabled={!consumableForm.name.trim() || !consumableForm.lotNumber.trim()}
            onClick={() => {
              consumables.registerConsumable(eq.id, {
                name: consumableForm.name.trim(), lotNumber: consumableForm.lotNumber.trim(), expiryDate: new Date(consumableForm.expiryDate).toISOString(),
                unit: consumableForm.unit, quantityOnHand: +consumableForm.quantityOnHand || 0, reorderThreshold: +consumableForm.reorderThreshold || 0,
                costPerUnit: +consumableForm.costPerUnit || 0, supplier: consumableForm.supplier || undefined,
              });
              setRegisterConsumableModal(false);
            }}
          >
            Register
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="Name"><Input value={consumableForm.name} onChange={(e) => setConsumableForm({ ...consumableForm, name: e.target.value })} placeholder="e.g. Hemoglobin reagent kit" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lot number"><Input value={consumableForm.lotNumber} onChange={(e) => setConsumableForm({ ...consumableForm, lotNumber: e.target.value })} /></Field>
            <Field label="Expiry date"><Input type="date" value={consumableForm.expiryDate} onChange={(e) => setConsumableForm({ ...consumableForm, expiryDate: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Unit"><Input value={consumableForm.unit} onChange={(e) => setConsumableForm({ ...consumableForm, unit: e.target.value })} placeholder="kit, mL, test" /></Field>
            <Field label="Qty on hand"><Input type="number" value={consumableForm.quantityOnHand} onChange={(e) => setConsumableForm({ ...consumableForm, quantityOnHand: e.target.value })} /></Field>
            <Field label="Reorder at"><Input type="number" value={consumableForm.reorderThreshold} onChange={(e) => setConsumableForm({ ...consumableForm, reorderThreshold: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost per unit (₦)"><Input type="number" value={consumableForm.costPerUnit} onChange={(e) => setConsumableForm({ ...consumableForm, costPerUnit: e.target.value })} /></Field>
            <Field label="Supplier" hint="Optional"><Input value={consumableForm.supplier} onChange={(e) => setConsumableForm({ ...consumableForm, supplier: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>

      {receiveStockId && (
        <Modal
          open
          onClose={() => setReceiveStockId(null)}
          title="Receive Stock"
          footer={<><Button variant="ghost" onClick={() => setReceiveStockId(null)}>Cancel</Button>
            <Button disabled={!(+receiveQty > 0)} onClick={() => { consumables.receiveStock(receiveStockId, +receiveQty); setReceiveStockId(null); }}>Receive</Button></>}
        >
          <Field label="Quantity received"><Input type="number" value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)} /></Field>
        </Modal>
      )}

      {wastageId && (
        <Modal
          open
          onClose={() => setWastageId(null)}
          title="Record Wastage"
          footer={<><Button variant="ghost" onClick={() => setWastageId(null)}>Cancel</Button>
            <Button
              disabled={!(+wastageQty > 0)}
              onClick={() => { consumables.consume(wastageId, +wastageQty, { reason: "Wastage", source: "USER" }); setWastageId(null); }}
            >
              Record
            </Button></>}
        >
          <Field label="Quantity wasted"><Input type="number" value={wastageQty} onChange={(e) => setWastageQty(e.target.value)} /></Field>
        </Modal>
      )}

      <Modal
        open={warrantyModal}
        onClose={() => setWarrantyModal(false)}
        title="Warranty Coverage"
        footer={<><Button variant="ghost" onClick={() => setWarrantyModal(false)}>Cancel</Button>
          <Button
            disabled={!warrantyForm.provider.trim() || !warrantyForm.coverage.trim()}
            onClick={() => {
              warranty.setWarranty(eq.id, {
                provider: warrantyForm.provider.trim(), start: new Date(warrantyForm.start).toISOString(), end: new Date(warrantyForm.end).toISOString(),
                coverage: warrantyForm.coverage.trim(), contactName: warrantyForm.contactName || undefined, contactPhone: warrantyForm.contactPhone || undefined,
                slaHours: warrantyForm.slaHours ? +warrantyForm.slaHours : undefined,
              });
              setWarrantyModal(false);
            }}
          >
            Save
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="Provider"><Input value={warrantyForm.provider} onChange={(e) => setWarrantyForm({ ...warrantyForm, provider: e.target.value })} /></Field>
          <Field label="Coverage"><Textarea value={warrantyForm.coverage} onChange={(e) => setWarrantyForm({ ...warrantyForm, coverage: e.target.value })} placeholder="e.g. Parts and labor, excludes consumables" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start"><Input type="date" value={warrantyForm.start} onChange={(e) => setWarrantyForm({ ...warrantyForm, start: e.target.value })} /></Field>
            <Field label="End"><Input type="date" value={warrantyForm.end} onChange={(e) => setWarrantyForm({ ...warrantyForm, end: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact name" hint="Optional"><Input value={warrantyForm.contactName} onChange={(e) => setWarrantyForm({ ...warrantyForm, contactName: e.target.value })} /></Field>
            <Field label="Contact phone" hint="Optional"><Input value={warrantyForm.contactPhone} onChange={(e) => setWarrantyForm({ ...warrantyForm, contactPhone: e.target.value })} /></Field>
          </div>
          <Field label="Response SLA (hours)" hint="Optional"><Input type="number" value={warrantyForm.slaHours} onChange={(e) => setWarrantyForm({ ...warrantyForm, slaHours: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal
        open={claimModal}
        onClose={() => setClaimModal(false)}
        title="File Warranty Claim"
        footer={<><Button variant="ghost" onClick={() => setClaimModal(false)}>Cancel</Button>
          <Button disabled={!claimForm.issue.trim()} onClick={() => { warranty.fileClaim(eq.id, claimForm.issue.trim(), claimForm.relatedWorkOrderId || undefined); setClaimModal(false); }}>
            File Claim
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="Issue"><Textarea value={claimForm.issue} onChange={(e) => setClaimForm({ ...claimForm, issue: e.target.value })} placeholder="What needs to be covered under warranty?" /></Field>
          {workOrders.length > 0 && (
            <Field label="Linked work order" hint="Optional">
              <Select
                value={claimForm.relatedWorkOrderId}
                onChange={(e) => setClaimForm({ ...claimForm, relatedWorkOrderId: e.target.value })}
                options={[{ value: "", label: "None" }, ...workOrders.map((w) => ({ value: w.id, label: `${w.type} — ${w.description.slice(0, 40)}` }))]}
              />
            </Field>
          )}
        </div>
      </Modal>

      {completeClaimId && (
        <Modal
          open
          onClose={() => setCompleteClaimId(null)}
          title="Resolve Warranty Claim"
          footer={<><Button variant="ghost" onClick={() => setCompleteClaimId(null)}>Cancel</Button>
            <Button
              onClick={() => {
                warranty.updateClaimStatus(completeClaimId, "Completed", {
                  repairedUnderWarranty: completeClaimForm.repairedUnderWarranty,
                  costRecovered: completeClaimForm.costRecovered ? +completeClaimForm.costRecovered : undefined,
                  resolutionNote: completeClaimForm.resolutionNote || undefined,
                });
                setCompleteClaimId(null);
              }}
            >
              Complete
            </Button></>}
        >
          <div className="space-y-4">
            <Checkbox
              label="Repaired under warranty (no cost to facility)"
              checked={completeClaimForm.repairedUnderWarranty}
              onChange={(e) => setCompleteClaimForm({ ...completeClaimForm, repairedUnderWarranty: e.target.checked })}
            />
            <Field label="Cost recovered (₦)" hint="Optional — e.g. parts reimbursed"><Input type="number" value={completeClaimForm.costRecovered} onChange={(e) => setCompleteClaimForm({ ...completeClaimForm, costRecovered: e.target.value })} /></Field>
            <Field label="Resolution note" hint="Optional"><Textarea value={completeClaimForm.resolutionNote} onChange={(e) => setCompleteClaimForm({ ...completeClaimForm, resolutionNote: e.target.value })} /></Field>
          </div>
        </Modal>
      )}

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

function ReliabilityStat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-mist-400">{icon}<span className="text-xs font-semibold uppercase tracking-wide">{label}</span></div>
      <p className="mt-1 text-xl font-bold text-mist-900">{value}</p>
      <p className="text-[11px] text-mist-400">{hint}</p>
    </Card>
  );
}

function WorkOrderCard({
  wo, onStart, onChecklist, onDiagnosis, onAddPart, onRemovePart, partForm, onPartFormChange, onComplete, onCancel,
}: {
  wo: WorkOrder;
  onStart: () => void;
  onChecklist: (itemId: string, done: boolean) => void;
  onDiagnosis: (diagnosis: string, correctiveAction: string) => void;
  onAddPart: () => void;
  onRemovePart: (index: number) => void;
  partForm: { name: string; qty: string; cost: string };
  onPartFormChange: (patch: Partial<{ name: string; qty: string; cost: string }>) => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const open = !["Completed", "Cancelled"].includes(wo.status);
  const partsTotal = wo.partsUsed.reduce((n, p) => n + p.qty * p.cost, 0);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={wo.type === "Emergency" ? "action" : wo.type === "Corrective" ? "amber" : "mist"}>{wo.type}</Badge>
          <Badge tone={wo.severity === "Critical" || wo.severity === "High" ? "action" : wo.severity === "Medium" ? "amber" : "mist"}>{wo.severity}</Badge>
          <span className="text-xs font-semibold text-mist-600">{wo.status}</span>
        </div>
        <span className="text-[11px] text-mist-300">{dateTime(wo.reportedAt)} · {wo.reportedBy}</span>
      </div>
      <p className="mt-1.5 text-sm text-mist-700">{wo.description}</p>
      {wo.scheduledFor && <p className="mt-1 text-xs text-mist-400">Scheduled for {shortDate(wo.scheduledFor)}{wo.technician ? ` · ${wo.technician}` : ""}</p>}

      {(wo.status === "Requested" || wo.status === "Scheduled") && (
        <div className="mt-2">
          <button onClick={onStart} className="btn-primary px-2.5 py-1 text-xs">Start Work</button>
        </div>
      )}

      {wo.status === "In Progress" && (
        <div className="mt-3 space-y-3 border-t border-mist-100 pt-3">
          {wo.checklist.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-mist-500">Checklist</p>
              <div className="grid grid-cols-2 gap-1.5">
                {wo.checklist.map((item) => (
                  <Checkbox key={item.id} label={item.label} checked={item.done} onChange={(e) => onChecklist(item.id, e.target.checked)} />
                ))}
              </div>
            </div>
          )}
          {wo.type !== "Preventive" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Diagnosis"><Textarea value={wo.diagnosis ?? ""} onChange={(e) => onDiagnosis(e.target.value, wo.correctiveAction ?? "")} /></Field>
              <Field label="Corrective action"><Textarea value={wo.correctiveAction ?? ""} onChange={(e) => onDiagnosis(wo.diagnosis ?? "", e.target.value)} /></Field>
            </div>
          )}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-mist-500">Parts used {partsTotal > 0 && <span className="text-mist-400">· ₦{partsTotal.toLocaleString()}</span>}</p>
            {wo.partsUsed.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-0.5 text-xs text-mist-600">
                <span>{p.name} × {p.qty} — ₦{(p.qty * p.cost).toLocaleString()}</span>
                <button onClick={() => onRemovePart(i)} className="text-mist-400 hover:text-action-600"><Trash2 size={12} /></button>
              </div>
            ))}
            <div className="mt-1.5 grid grid-cols-[1fr_60px_80px_28px] items-center gap-1.5">
              <input className="input py-1 text-xs" placeholder="Part name" value={partForm.name} onChange={(e) => onPartFormChange({ name: e.target.value })} />
              <input className="input py-1 text-center text-xs" type="number" min={1} value={partForm.qty} onChange={(e) => onPartFormChange({ qty: e.target.value })} />
              <input className="input py-1 text-right text-xs" type="number" min={0} value={partForm.cost} onChange={(e) => onPartFormChange({ cost: e.target.value })} />
              <button onClick={onAddPart} className="text-brand-600 hover:text-brand-700"><Plus size={14} /></button>
            </div>
          </div>
          <button onClick={onComplete} className="btn-primary px-2.5 py-1 text-xs">Complete Work Order</button>
        </div>
      )}

      {wo.status === "Completed" && (
        <p className="mt-2 text-xs text-mist-400">
          Completed {wo.completedAt ? dateTime(wo.completedAt) : ""}
          {wo.downtimeMinutes ? ` · ${wo.downtimeMinutes} min downtime` : ""}
          {wo.laborCost ? ` · ₦${wo.laborCost.toLocaleString()} labor` : ""} · RTS test {wo.returnToServiceTested ? "passed" : "not recorded"}
        </p>
      )}
      {wo.status === "Cancelled" && <p className="mt-2 text-xs text-mist-400">Cancelled — {wo.cancelReason}</p>}

      {open && wo.status !== "In Progress" && (
        <div className="mt-2">
          <button onClick={onCancel} className="text-xs text-mist-400 hover:text-action-600">Cancel work order</button>
        </div>
      )}
    </Card>
  );
}

function CalibrationCard({ record, onStart, onComplete, onCancel }: { record: CalibrationRecord; onStart: () => void; onComplete: () => void; onCancel: () => void }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-mist-600">{record.status}</span>
          {record.result && <Badge tone={record.result === "Pass" ? "brand" : "action"}>{record.result}</Badge>}
        </div>
        <span className="text-[11px] text-mist-300">Scheduled {shortDate(record.scheduledFor)}</span>
      </div>
      <p className="mt-1 text-xs text-mist-500">
        {record.vendor && `Vendor: ${record.vendor} · `}{record.technician && `Technician: ${record.technician}`}
      </p>
      {record.status === "Scheduled" && (
        <div className="mt-2 flex gap-1.5">
          <button onClick={onStart} className="btn-primary px-2.5 py-1 text-xs">Start</button>
          <button onClick={onCancel} className="text-xs text-mist-400 hover:text-action-600">Cancel</button>
        </div>
      )}
      {record.status === "In Progress" && (
        <div className="mt-2">
          <button onClick={onComplete} className="btn-primary px-2.5 py-1 text-xs">Record Result</button>
        </div>
      )}
      {record.status === "Completed" && (
        <p className="mt-2 text-xs text-mist-400">
          {record.performedAt && dateTime(record.performedAt)}
          {record.certificateNumber && ` · Cert. ${record.certificateNumber}`}
          {record.certificateExpiry && ` · expires ${shortDate(record.certificateExpiry)}`}
        </p>
      )}
      {record.status === "Cancelled" && <p className="mt-2 text-xs text-mist-400">Cancelled — {record.cancelReason}</p>}
    </Card>
  );
}

function ConsumableItemCard({ item, onReceiveStock, onWastage }: { item: ConsumableItem; onReceiveStock: () => void; onWastage: () => void }) {
  const state = consumableStateFor(item);
  const tone = state === "OK" ? "brand" : state === "Low Stock" ? "amber" : "action";
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-mist-900">{item.name}</p>
          <p className="text-[11px] text-mist-400">Lot {item.lotNumber} · expires {shortDate(item.expiryDate)}{item.supplier ? ` · ${item.supplier}` : ""}</p>
        </div>
        <Badge tone={tone}>{state}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
        <span className="text-mist-600">{item.quantityOnHand} {item.unit} on hand</span>
        <span className="text-mist-400">Reorder at {item.reorderThreshold} {item.unit}</span>
        <span className="text-mist-400">₦{item.costPerUnit.toLocaleString()} / {item.unit}</span>
      </div>
      <div className="mt-2 flex gap-1.5">
        <button onClick={onReceiveStock} className="btn-soft px-2.5 py-1 text-xs">Receive Stock</button>
        <button onClick={onWastage} className="text-xs text-mist-400 hover:text-action-600">Record wastage</button>
      </div>
    </Card>
  );
}

function ClaimCard({
  claim, relatedWorkOrder, onApprove, onReject, onStartRepair, onComplete,
}: {
  claim: WarrantyClaim;
  relatedWorkOrder?: WorkOrder;
  onApprove: () => void;
  onReject: () => void;
  onStartRepair: () => void;
  onComplete: () => void;
}) {
  const tone: Record<WarrantyClaimStatus, "brand" | "action" | "mist" | "amber"> = {
    Submitted: "amber", Approved: "brand", "In Repair": "amber", Rejected: "action", Completed: "brand",
  };
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone={tone[claim.status]}>{claim.status}</Badge>
        <span className="text-[11px] text-mist-300">{dateTime(claim.raisedAt)} · {claim.raisedBy}</span>
      </div>
      <p className="mt-1.5 text-sm text-mist-700">{claim.issue}</p>
      {relatedWorkOrder && <p className="mt-1 text-xs text-mist-400">Linked to work order: {relatedWorkOrder.description}</p>}
      {claim.status === "Completed" && (
        <p className="mt-1 text-xs text-mist-400">
          {claim.repairedUnderWarranty ? "Repaired under warranty" : "Not covered"}
          {claim.costRecovered ? ` · ₦${claim.costRecovered.toLocaleString()} recovered` : ""}
          {claim.resolutionNote ? ` · ${claim.resolutionNote}` : ""}
        </p>
      )}
      {claim.status === "Rejected" && claim.resolutionNote && <p className="mt-1 text-xs text-mist-400">{claim.resolutionNote}</p>}
      {claim.status === "Submitted" && (
        <div className="mt-2 flex gap-1.5">
          <button onClick={onApprove} className="btn-primary px-2.5 py-1 text-xs">Approve</button>
          <button onClick={onReject} className="text-xs text-mist-400 hover:text-action-600">Reject</button>
        </div>
      )}
      {claim.status === "Approved" && (
        <div className="mt-2">
          <button onClick={onStartRepair} className="btn-primary px-2.5 py-1 text-xs">Start Repair</button>
        </div>
      )}
      {claim.status === "In Repair" && (
        <div className="mt-2">
          <button onClick={onComplete} className="btn-primary px-2.5 py-1 text-xs">Complete</button>
        </div>
      )}
    </Card>
  );
}
