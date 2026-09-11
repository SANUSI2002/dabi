import { Card } from "@/components/ui/primitives";
import type { EquipmentRecord } from "@/data/equipment";
import { shortDate } from "@/lib/format";
import { Row2 } from "./shared";

export function OverviewTab({ eq }: { eq: EquipmentRecord }) {
  return (
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
  );
}
