import { useState } from "react";
import { RefreshCw, Plug, Stethoscope, Users, Pill, CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Checkbox } from "@/components/ui/form";
import { timeAgo } from "@/lib/format";
import { useIntegrations } from "@/store/useIntegrations";

export default function Integrations() {
  const { autoSync, lastSyncAt, results, setAutoSync, pendingCounts, syncAll, syncEmrBilling, syncPayroll, syncPharmacy } = useIntegrations();
  const [busy, setBusy] = useState(false);
  const pending = pendingCounts();

  const run = (fn: () => void) => { setBusy(true); fn(); setTimeout(() => setBusy(false), 250); };
  const totalPending = pending.emrBilling + pending.payrollAccrual + pending.payrollSettlement + pending.pharmacy;

  const connectors = [
    { name: "EMR — Patient Billing", icon: Stethoscope, desc: "Patient invoices → Accounts Receivable, revenue by service, receipts on payment", pending: pending.emrBilling, run: () => run(syncEmrBilling) },
    { name: "Workforce — Payroll", icon: Users, desc: "Confirmed payroll batches → salary expense, statutory payables, net-pay settlement", pending: pending.payrollAccrual + pending.payrollSettlement, run: () => run(syncPayroll) },
    { name: "EMR — Pharmacy", icon: Pill, desc: "Dispensed drugs → cost of goods sold, inventory relieved at FIFO / average cost", pending: pending.pharmacy, run: () => run(syncPharmacy) },
  ];

  return (
    <div>
      <PageHeader title="Integrations" subtitle="How Accounting stays in step with the rest of Sabi — one-directional, event-style, and optional"
        actions={<Button onClick={() => run(() => syncAll())} disabled={busy}><RefreshCw size={15} className={busy ? "animate-spin" : ""} /> Sync now</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Connectors" value={connectors.length} tone="brand" icon={<Plug size={18} />} />
        <StatCard label="Pending events" value={totalPending} tone={totalPending ? "amber" : "brand"} delay={0.05} />
        <StatCard label="Last sync" value={lastSyncAt ? timeAgo(lastSyncAt) : "—"} tone="mist" delay={0.1} />
      </div>

      <Card className="mb-4">
        <Checkbox label="Auto-sync — mirror EMR and Workforce activity into the ledger automatically as you navigate" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
      </Card>

      <div className="space-y-3">
        {connectors.map((c) => (
          <Card key={c.name} className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-brand-50 p-2 text-brand-700 ring-1 ring-brand-200"><c.icon size={18} /></div>
              <div>
                <p className="font-semibold text-mist-900">{c.name}</p>
                <p className="max-w-xl text-sm text-mist-500">{c.desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {c.pending > 0 ? <Badge tone="amber">{c.pending} pending</Badge> : <Badge tone="brand">up to date</Badge>}
              <Button variant="soft" onClick={c.run} disabled={busy}>Sync</Button>
            </div>
          </Card>
        ))}
      </div>

      {results.length > 0 && (
        <Card className="mt-4 p-0">
          <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-600">Last run</p>
          <Table columns={["Module", "Created", "Skipped", "Result"]}>
            {results.map((r, i) => (
              <Row key={i} index={i}>
                <Cell className="font-semibold">{r.module}</Cell>
                <Cell className="font-mono">{r.created}</Cell>
                <Cell className="font-mono">{r.skipped}</Cell>
                <Cell>{r.errors.length === 0 ? <span className="flex items-center gap-1 text-brand-700"><CheckCircle2 size={14} /> Clean</span> : <span className="flex items-center gap-1 text-action-600"><AlertTriangle size={14} /> {r.errors[0]}</span>}</Cell>
              </Row>
            ))}
          </Table>
        </Card>
      )}

      <div className="mt-6 rounded-xl border border-mist-200 bg-mist-50/60 p-4 text-sm text-mist-600">
        <p className="mb-1 font-semibold text-mist-800">Architecture</p>
        EMR and Workforce never import Accounting; Accounting never imports EMR or Workforce. This layer is the only place the
        products meet — it reads their domain state and calls the <code className="text-xs">accountingApi</code> façade
        (create invoice, record receipt, post journal, get balances, financial statements). Ship Accounting on its own and this
        layer simply finds nothing to sync.
      </div>
    </div>
  );
}
