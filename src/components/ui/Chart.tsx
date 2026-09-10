import { type ReactNode } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell, ReferenceArea,
} from "recharts";

export const CHART_COLORS = ["#0fc06d", "#2fdd8a", "#f83b3b", "#0a4f32", "#84bd9b", "#f59e0b"];

const axisProps = { tickLine: false, axisLine: false, tick: { fontSize: 11, fill: "#84bd9b" } } as const;
const gridProps = { strokeDasharray: "3 3", stroke: "#e8f4ec", vertical: false } as const;

function Frame({ height = 256, children }: { height?: number; children: ReactNode }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%" debounce={1}>
        {children as never}
      </ResponsiveContainer>
    </div>
  );
}

const tip = {
  cursor: { fill: "rgba(15,192,109,0.06)" },
  contentStyle: {
    borderRadius: 12,
    border: "1px solid #d3e9db",
    boxShadow: "0 12px 40px -12px rgba(6,62,40,.25)",
    fontSize: 12,
  },
} as const;

export function Bars({
  data,
  x,
  series,
  height,
  layout = "horizontal",
  stacked,
}: {
  data: Record<string, string | number>[];
  x: string;
  series: { key: string; label?: string; color?: string }[];
  height?: number;
  layout?: "horizontal" | "vertical";
  stacked?: boolean;
}) {
  const vertical = layout === "vertical";
  return (
    <Frame height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 4, right: 8, bottom: 0, left: vertical ? 8 : -8 }}>
        <CartesianGrid {...gridProps} vertical={vertical} horizontal={!vertical} />
        {vertical ? (
          <>
            <XAxis type="number" {...axisProps} />
            <YAxis type="category" dataKey={x} width={110} {...axisProps} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} {...axisProps} />
            <YAxis {...axisProps} allowDecimals={false} />
          </>
        )}
        <Tooltip {...tip} />
        {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label ?? s.key}
            fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={vertical ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            barSize={vertical ? 14 : 22}
            stackId={stacked ? "a" : undefined}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </Frame>
  );
}

export function Donut({
  data,
  height = 220,
  centerLabel,
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  centerLabel?: string;
}) {
  const total = data.reduce((n, d) => n + d.value, 0);
  return (
    <div className="relative" style={{ height }}>
      <Frame height={height}>
        <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Tooltip {...tip} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="58%"
            outerRadius="80%"
            paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((d, i) => (
              <Cell key={d.label} fill={d.color ?? CHART_COLORS[i % CHART_COLORS.length]} stroke="#fff" strokeWidth={2} />
            ))}
          </Pie>
        </PieChart>
      </Frame>
      <div className="pointer-events-none absolute inset-x-0 top-0 grid place-items-center" style={{ height: height - 40 }}>
        <div className="text-center">
          <p className="font-display text-2xl font-bold text-mist-900">{total}</p>
          {centerLabel && <p className="text-[10px] font-semibold uppercase text-mist-400">{centerLabel}</p>}
        </div>
      </div>
    </div>
  );
}

export function Lines({
  data,
  x,
  series,
  height,
  area,
  yAllowDecimals = false,
  yDomain,
  referenceBand,
}: {
  data: Record<string, string | number>[];
  x: string;
  series: { key: string; label?: string; color?: string }[];
  height?: number;
  area?: boolean;
  yAllowDecimals?: boolean;
  yDomain?: [number | "auto" | "dataMin" | "dataMax", number | "auto" | "dataMin" | "dataMax"];
  /** shaded normal / reference range behind the trend */
  referenceBand?: { from: number; to: number };
}) {
  const Comp = area ? AreaChart : LineChart;
  return (
    <Frame height={height}>
      <Comp data={data} margin={{ top: 4, right: 10, bottom: 0, left: -12 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey={x} {...axisProps} />
        <YAxis {...axisProps} allowDecimals={yAllowDecimals} domain={yDomain as never} />
        {referenceBand && (
          <ReferenceArea
            y1={referenceBand.from}
            y2={referenceBand.to}
            fill="#0fc06d"
            fillOpacity={0.06}
            stroke="#0fc06d"
            strokeOpacity={0.15}
            strokeDasharray="2 2"
          />
        )}
        <Tooltip {...tip} />
        {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s, i) => {
          const c = s.color ?? CHART_COLORS[i % CHART_COLORS.length];
          return area ? (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label ?? s.key} stroke={c} fill={c} fillOpacity={0.12} strokeWidth={2.5} isAnimationActive={false} />
          ) : (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label ?? s.key} stroke={c} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          );
        })}
      </Comp>
    </Frame>
  );
}
