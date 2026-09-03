import { Card, Badge, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Bars, Lines } from "@/components/ui/Chart";
import type { ReportTab } from "./config";
import type { EmrSnapshot } from "./types";

export function ReportView({ tab, snap }: { tab: ReportTab; snap: EmrSnapshot }) {
  if (tab.kind === "empty") {
    return <EmptyState title={`${tab.name} · no records in this period`} hint={tab.hint} />;
  }

  if (tab.kind === "table") {
    const rows = tab.rows(snap);
    if (rows.length === 0)
      return <EmptyState title={`${tab.name} · no records`} hint="Nothing was recorded for the selected range." />;
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
            <div key={r.k} className="flex items-center justify-between gap-4 py-2.5 text-sm">
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
    const data = tab.data(snap);
    if (data.length === 0) return <EmptyState title={`${tab.name} · no data`} hint="Nothing to chart for this range." />;
    return (
      <Card>
        <Bars data={data} x="label" series={[{ key: tab.keys[0], color: "#0fc06d" }]} />
      </Card>
    );
  }

  // line
  const data = tab.data(snap);
  if (data.length === 0) return <EmptyState title={`${tab.name} · no data`} hint="Nothing to chart for this range." />;
  const x = "date" in data[0] ? "date" : "label";
  return (
    <Card>
      <Lines data={data} x={x} series={tab.keys.map((k) => ({ key: k, label: k }))} />
    </Card>
  );
}

export { Badge };
