import { Card, EmptyState } from "@/components/ui/primitives";
import { Lines } from "@/components/ui/Chart";
import { useEquipment } from "@/store/useEquipment";
import { TELEMETRY_PARAMS } from "@/data/equipmentTelemetry";
import type { EquipmentRecord } from "@/data/equipment";
import { dateTime } from "@/lib/format";

export function TelemetryTab({ eq }: { eq: EquipmentRecord }) {
  const store = useEquipment();
  const params = TELEMETRY_PARAMS[eq.category] ?? [];

  if (params.length === 0) {
    return <EmptyState title="No telemetry parameters defined" hint="This equipment category has no configured telemetry set." />;
  }

  return (
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
  );
}
