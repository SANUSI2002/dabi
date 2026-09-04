import { Card, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Bars } from "@/components/ui/Chart";
import type { HrReportTab } from "./config";
import type { HrSnapshot } from "./types";

export function HrReportView({ tab, snap }: { tab: HrReportTab; snap: HrSnapshot }) {
  if (tab.kind === "empty") {
    return <EmptyState title={`${tab.name} · no records`} hint={tab.hint} />;
  }

  if (tab.kind === "table") {
    const rows = tab.rows(snap);
    if (rows.length === 0)
      return <EmptyState title={`${tab.name} · no records`} hint="Nothing to show yet." />;
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
    const rows = tab.rows(snap);
    return (
      <Card>
        <div className="divide-y divide-mist-100">
          {rows.map((r) => (
            <div key={r.k} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-mist-600">{r.k}</span>
              <span className="flex items-center gap-2">
                {r.target && <span className="text-[11px] text-mist-400">target {r.target}</span>}
                <span className="font-semibold text-mist-900">{r.v}</span>
              </span>
            </div>
          ))}
          {rows.length === 0 && <p className="py-2 text-sm text-mist-400">Nothing to show yet.</p>}
        </div>
      </Card>
    );
  }

  const data = tab.data(snap);
  if (data.length === 0) return <EmptyState title={`${tab.name} · no data`} hint="Nothing to chart yet." />;
  return (
    <Card>
      <Bars data={data} x="label" series={[{ key: "value", color: "#0fc06d" }]} />
    </Card>
  );
}
