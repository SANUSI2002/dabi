import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { useEquipment, maintenanceStateFor, calibrationStateFor, safetyStateFor } from "@/store/useEquipment";
import { useEquipmentEvents } from "@/store/useEquipmentEvents";
import { useEquipmentMaintenance } from "@/store/useEquipmentMaintenance";
import { useEquipmentCalibration } from "@/store/useEquipmentCalibration";
import { useEquipmentUsage } from "@/store/useEquipmentUsage";
import { startEquipmentSimulator } from "@/lib/equipmentSimulator";
import { developmentFixturesEnabled } from "@/config/runtime";
import { MachineStateBadge, ConnectivityBadge, MaintenanceStateBadge, SafetyStateBadge } from "@/components/equipment/EquipmentStatusBadge";
import { IntegrationBadge } from "@/components/equipment/IntegrationBadge";
import { OverviewTab } from "./detail/OverviewTab";
import { LiveTab } from "./detail/LiveTab";
import { TelemetryTab } from "./detail/TelemetryTab";
import { UsageTab } from "./detail/UsageTab";
import { TimelineTab } from "./detail/TimelineTab";
import { AlarmsTab } from "./detail/AlarmsTab";
import { MaintenanceTab } from "./detail/MaintenanceTab";
import { CalibrationTab } from "./detail/CalibrationTab";
import { ConsumablesTab } from "./detail/ConsumablesTab";
import { WarrantyTab } from "./detail/WarrantyTab";
import { AnalyticsTab } from "./detail/AnalyticsTab";

export default function EquipmentDetail() {
  const { id } = useParams();
  const store = useEquipment();
  const events = useEquipmentEvents();
  const maint = useEquipmentMaintenance();
  const cal = useEquipmentCalibration();
  const usage = useEquipmentUsage();

  useEffect(() => {
    if (developmentFixturesEnabled) startEquipmentSimulator();
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
  const timelineCount = events.timelineFor(eq.id).length;
  const alarmsCount = events.alarmsFor(eq.id).length;
  const workOrdersCount = maint.workOrdersFor(eq.id).length;
  const calRecordsCount = cal.recordsFor(eq.id).length;
  const usageCount = usage.sessionsFor(eq.id).length;

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
          "Overview", "Live", "Telemetry", `Usage (${usageCount})`, `Timeline (${timelineCount})`,
          `Alarms (${alarmsCount})`, `Maintenance (${workOrdersCount})`, `Calibration (${calRecordsCount})`,
          "Consumables", "Warranty", "Analytics",
        ]}
      >
        {(tab) =>
          tab === "Overview" ? <OverviewTab eq={eq} />
          : tab === "Live" ? <LiveTab eq={eq} />
          : tab === "Telemetry" ? <TelemetryTab eq={eq} />
          : tab.startsWith("Usage") ? <UsageTab eq={eq} />
          : tab.startsWith("Timeline") ? <TimelineTab eq={eq} />
          : tab.startsWith("Alarms") ? <AlarmsTab eq={eq} />
          : tab.startsWith("Maintenance") ? <MaintenanceTab eq={eq} />
          : tab.startsWith("Calibration") ? <CalibrationTab eq={eq} />
          : tab === "Consumables" ? <ConsumablesTab eq={eq} />
          : tab === "Warranty" ? <WarrantyTab eq={eq} />
          : tab === "Analytics" ? <AnalyticsTab eq={eq} />
          : null
        }
      </Tabs>
    </div>
  );
}
