import { useMemo, useState } from "react";
import { ScrollText, Search } from "lucide-react";
import { PageHeader, Card, Badge, StatCard, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Input, Select } from "@/components/ui/form";
import { dateTime } from "@/lib/format";
import { useAudit } from "@/store/useAudit";

const MODULES = ["all", "journal", "invoices", "receipts", "credit-notes", "bills", "vendor-payments", "expenses", "banking", "fixed-assets", "inventory", "tax", "budgets", "projects", "coa", "settings", "approvals"];

export default function AuditTrail() {
  const events = useAudit((s) => s.events);
  const [q, setQ] = useState("");
  const [mod, setMod] = useState("all");

  const acct = useMemo(() => events.filter((e) => e.resource.startsWith("accounting/")), [events]);
  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return acct.filter((e) =>
      (mod === "all" || e.resource.startsWith(`accounting/${mod}`)) &&
      (!s || e.action.toLowerCase().includes(s) || e.resource.toLowerCase().includes(s) || e.user.toLowerCase().includes(s)),
    );
  }, [acct, q, mod]);

  const today = acct.filter((e) => new Date(e.ts).toDateString() === new Date().toDateString()).length;
  const actors = new Set(acct.map((e) => e.user)).size;

  return (
    <div>
      <PageHeader title="Accounting Audit Trail" subtitle="Every mutating action in the accounting module, who did it and when — filtered from the system-wide log" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Accounting events" value={acct.length} tone="brand" icon={<ScrollText size={18} />} />
        <StatCard label="Today" value={today} tone="mist" delay={0.05} />
        <StatCard label="People involved" value={actors} tone="mist" delay={0.1} />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action, document or person…" className="pl-9" />
          </div>
          <Select value={mod} onChange={(e) => setMod(e.target.value)} options={MODULES.map((m) => ({ value: m, label: m === "all" ? "All modules" : m }))} className="w-48" />
        </div>
      </Card>

      {filtered.length === 0 ? <EmptyState title="No matching events" /> : (
        <Card className="p-0">
          <Table columns={["When", "Who", "Action", "Document / resource"]}>
            {filtered.slice(0, 300).map((e, i) => (
              <Row key={e.id} index={i}>
                <Cell className="whitespace-nowrap text-mist-500">{dateTime(e.ts)}</Cell>
                <Cell className="font-semibold">{e.user}<span className="block text-xs font-normal text-mist-400">{e.role}</span></Cell>
                <Cell><Badge tone="mist">{e.action}</Badge></Cell>
                <Cell className="font-mono text-xs text-mist-500">{e.resource.replace(/^accounting\//, "")}</Cell>
              </Row>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
