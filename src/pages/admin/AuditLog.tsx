import { useState } from "react";
import { ScrollText, FileDown } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { auditTrail } from "@/data/mock";
import { dateTime } from "@/lib/format";

export default function AuditLog() {
  const [action, setAction] = useState("All");
  const actions = ["All", ...new Set(auditTrail.map((e) => e.action))];
  const rows = auditTrail.filter((e) => action === "All" || e.action === action);

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="NDPR compliance · full activity history"
        actions={<Button variant="ghost"><FileDown size={15} /> Export CSV</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Events (24h)" value={auditTrail.length} tone="brand" icon={<ScrollText size={18} />} />
        <StatCard label="Users" value={new Set(auditTrail.map((e) => e.user)).size} tone="mist" delay={0.05} />
        <StatCard label="Distinct Actions" value={actions.length - 1} tone="mist" delay={0.1} />
        <StatCard label="Data Exports" value={auditTrail.filter((e) => e.action.includes("REPORT")).length} tone="action" delay={0.15} />
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
            <Cell className="text-mist-400">{dateTime(e.ts)}</Cell>
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
