import { useMemo, useState } from "react";
import { ScrollText, FileDown } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { useAudit } from "@/store/useAudit";
import { dateTime, timeAgo } from "@/lib/format";

export default function AuditLog() {
  const events = useAudit((s) => s.events);
  const [action, setAction] = useState("All");
  const actions = useMemo(() => ["All", ...new Set(events.map((e) => e.action))].slice(0, 14), [events]);
  const rows = events.filter((e) => action === "All" || e.action === action);

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="NDPR compliance · full activity history"
        actions={<Button variant="ghost"><FileDown size={15} /> Export CSV</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Events logged" value={events.length} tone="brand" icon={<ScrollText size={18} />} />
        <StatCard label="Users" value={new Set(events.map((e) => e.user)).size} tone="mist" delay={0.05} />
        <StatCard label="Distinct actions" value={new Set(events.map((e) => e.action)).size} tone="mist" delay={0.1} />
        <StatCard label="Data exports" value={events.filter((e) => e.action.includes("REPORT")).length} tone="action" delay={0.15} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {actions.map((a) => (
          <button
            key={a}
            onClick={() => setAction(a)}
            className={`chip ${action === a ? "bg-brand-gradient text-white" : "bg-white text-mist-500 ring-1 ring-mist-200"}`}
          >
            {a}
          </button>
        ))}
      </div>

      <Table columns={["Timestamp", "User", "Role", "Action", "Resource", "IP Address"]}>
        {rows.map((e, i) => (
          <Row key={e.id} index={i}>
            <Cell className="text-mist-400">
              {dateTime(e.ts)}
              <span className="block text-[10px] text-mist-300">{timeAgo(e.ts)}</span>
            </Cell>
            <Cell className="font-semibold">{e.user}</Cell>
            <Cell>{e.role}</Cell>
            <Cell><Badge tone={e.action.includes("REPORT") ? "amber" : "brand"}>{e.action}</Badge></Cell>
            <Cell className="font-mono text-xs text-mist-500">{e.resource}</Cell>
            <Cell className="font-mono text-xs">{e.ip}</Cell>
          </Row>
        ))}
      </Table>
    </div>
  );
}
