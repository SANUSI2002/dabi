import { motion } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import type { ReportTab } from "./config";
import type { EmrSnapshot } from "./types";

export function ReportView({ tab, snap }: { tab: ReportTab; snap: EmrSnapshot }) {
  if (tab.kind === "empty") {
    return <EmptyState title={`${tab.name} · no records in this period`} hint={tab.hint} />;
  }

  if (tab.kind === "table") {
    const rows = tab.rows(snap);
    if (rows.length === 0) return <EmptyState title={`${tab.name} · no records`} hint="Nothing was recorded for the selected range." />;
    return (
      <Table columns={tab.columns}>
        {rows.map((r, i) => (
          <Row key={i} index={i}>
            {r.map((c, j) => (
              <Cell key={j} className={j === 0 ? "font-semibold text-mist-900" : undefined}>
                {String(c)}
              </Cell>
            ))}
          </Row>
        ))}
      </Table>
    );
  }

  if (tab.kind === "kv") {
    return (
      <Card>
        <div className="divide-y divide-mist-100">
          {tab.rows(snap).map((r) => (
            <div key={r.k} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-mist-600">{r.k}</span>
              <span className="flex items-center gap-2">
                {r.target && <span className="text-[11px] text-mist-400">target {r.target}</span>}
                <span className="font-semibold text-mist-900">{r.v}</span>
              </span>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (tab.kind === "bars") {
    return (
      <Card>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={tab.data(snap)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8f4ec" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip cursor={{ fill: "rgba(15,192,109,0.06)" }} />
              <Bar dataKey={tab.keys[0]} fill="#0fc06d" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    );
  }

  // line
  const palette = ["#9ff9cb", "#0fc06d", "#f83b3b", "#0a4f32"];
  return (
    <Card>
      <div className="h-64">
        <ResponsiveContainer>
          <LineChart data={tab.data(snap)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8f4ec" vertical={false} />
            <XAxis dataKey={tab.data(snap)[0]?.date !== undefined ? "date" : "label"} tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip />
            {tab.keys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={palette[i % palette.length]} strokeWidth={2.5} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-mist-500">
        {tab.keys.map((k, i) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded" style={{ background: palette[i % palette.length] }} /> {k}
          </span>
        ))}
      </div>
    </Card>
  );
}

export const fade = motion.div;
