import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Lines } from "@/components/ui/Chart";
import { EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { dateTime, timeAgo } from "@/lib/format";

// Shared trend view for both outpatient (useEmr.vitals) and inpatient
// (useNursing.observations) readings — normalised to one shape here so the
// chart/table logic isn't duplicated between Consultation and Ward Round.
export type VitalReading = {
  at: string;
  by: string;
  bp?: string;
  temp?: number;
  pulse?: number;
  resp?: number;
  spo2?: number;
  glucose?: number;
  painScore?: number;
};

const RANGE_OPTIONS = [
  { key: "6h", label: "6h", hours: 6 },
  { key: "12h", label: "12h", hours: 12 },
  { key: "24h", label: "24h", hours: 24 },
  { key: "48h", label: "48h", hours: 48 },
  { key: "3d", label: "3d", hours: 72 },
  { key: "7d", label: "7d", hours: 168 },
  { key: "all", label: "All", hours: Infinity },
] as const;

type RangeKey = (typeof RANGE_OPTIONS)[number]["key"];

/** the narrowest preset range that still includes the most recent reading,
 *  so opening the trend never lands on a silent "no readings" for a patient
 *  whose latest vitals simply predate the shorter clinical windows. */
function defaultRangeFor(readings: VitalReading[]): RangeKey {
  if (readings.length === 0) return "24h";
  const latest = Math.max(...readings.map((reading) => +new Date(reading.at)));
  const ageHours = (Date.now() - latest) / 3_600_000;
  return (RANGE_OPTIONS.find((r) => r.hours >= ageHours) ?? RANGE_OPTIONS[RANGE_OPTIONS.length - 1]).key;
}

const METRICS = [
  { key: "pulse", label: "Heart rate", unit: "bpm", color: "#f83b3b" },
  { key: "resp", label: "Respiratory rate", unit: "/min", color: "#0a4f32" },
  { key: "temp", label: "Temperature", unit: "°C", color: "#f59e0b" },
  { key: "spo2", label: "SpO₂", unit: "%", color: "#0fc06d" },
  { key: "glucose", label: "Glucose", unit: "mg/dL", color: "#2fdd8a" },
  { key: "painScore", label: "Pain score", unit: "/10", color: "#84bd9b" },
] as const;

export function VitalTrend({ open, onClose, readings }: { open: boolean; onClose: () => void; readings: VitalReading[] }) {
  const [rangeKey, setRangeKey] = useState<RangeKey>("24h");
  const [metricKey, setMetricKey] = useState<(typeof METRICS)[number]["key"]>("pulse");

  useEffect(() => {
    if (open) setRangeKey(defaultRangeFor(readings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const range = RANGE_OPTIONS.find((r) => r.key === rangeKey)!;
  const cutoff = cutoffFor(range.hours);
  const inRange = useMemo(
    () =>
      readings
        .filter((reading) => +new Date(reading.at) >= cutoff)
        .sort((left, right) => +new Date(left.at) - +new Date(right.at)),
    [readings, cutoff],
  );

  const metric = METRICS.find((m) => m.key === metricKey)!;
  const chartData = inRange
    .filter((reading) => reading[metric.key] !== undefined)
    .map((reading) => ({ label: dateTime(reading.at), [metric.key]: reading[metric.key] as number }));

  return (
    <Modal open={open} onClose={onClose} title="Vital sign trend" wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r.key}
                onClick={() => setRangeKey(r.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                  r.key === rangeKey ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-mist-600 ring-mist-200 hover:bg-mist-50"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetricKey(m.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                  m.key === metricKey ? "bg-mist-800 text-white ring-mist-800" : "bg-white text-mist-600 ring-mist-200 hover:bg-mist-50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {chartData.length > 0 ? (
          <Lines data={chartData} x="label" series={[{ key: metric.key, label: `${metric.label} (${metric.unit})`, color: metric.color }]} height={220} />
        ) : (
          <EmptyState compact title="No readings in this range" hint={`No ${metric.label.toLowerCase()} recorded in the selected window.`} />
        )}

        <div className="max-h-64 overflow-y-auto">
          <Table columns={["Time", "BP", "HR", "RR", "Temp", "SpO₂", "Glucose", "Pain", "Recorded by"]}>
            {inRange.length === 0 ? (
              <EmptyRow colSpan={9}>No vital signs recorded in this range.</EmptyRow>
            ) : (
              [...inRange].reverse().map((reading) => (
                <Row key={reading.at + reading.by}>
                  <Cell>
                    {dateTime(reading.at)}
                    <div className="text-[11px] text-mist-400">{timeAgo(reading.at)}</div>
                  </Cell>
                  <Cell>{reading.bp ?? "—"}</Cell>
                  <Cell>{reading.pulse ?? "—"}</Cell>
                  <Cell>{reading.resp ?? "—"}</Cell>
                  <Cell>{reading.temp ?? "—"}</Cell>
                  <Cell>{reading.spo2 ?? "—"}</Cell>
                  <Cell>{reading.glucose ?? "—"}</Cell>
                  <Cell>{reading.painScore ?? "—"}</Cell>
                  <Cell>{reading.by}</Cell>
                </Row>
              ))
            )}
          </Table>
        </div>
      </div>
    </Modal>
  );
}

function cutoffFor(hours: number) {
  return Date.now() - hours * 3_600_000;
}
