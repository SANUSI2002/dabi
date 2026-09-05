import { Link } from "react-router-dom";
import { Check, X, ShieldCheck, ArrowRight } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { money, shortDate } from "@/lib/format";
import { useAP, purchaseTotal } from "@/store/accounting/useAP";
import { useExpenses, claimTotal } from "@/store/accounting/useExpenses";
import { useAcctControl } from "@/store/accounting/useAcctControl";
import { useIdentity } from "@/store/useIdentity";
import { useHr } from "@/store/useHr";

export default function AccountingApprovals() {
  const { bills, requisitions, vendorById, decideBill, decideRequisition } = useAP();
  const { claims, decideClaim } = useExpenses();
  const { canDecide, myRole } = useAcctControl();
  useIdentity((s) => s.user.id);
  const staff = useHr((s) => s.staff);
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

  const pendingBills = bills.filter((b) => b.status === "Pending Approval");
  const pendingPRs = requisitions.filter((r) => r.status === "Pending Approval");
  const pendingClaims = claims.filter((c) => c.status === "Pending Approval");

  const mine = [
    ...pendingBills.filter((b) => canDecide(b.approval)).map((b) => ({ id: b.id, kind: "Bill" as const, ref: b.number, who: vendorById(b.vendorId)?.name ?? "", amount: purchaseTotal(b.lines), date: b.date, level: b.approval.currentLevel })),
    ...pendingPRs.filter((r) => canDecide(r.approval)).map((r) => ({ id: r.id, kind: "Requisition" as const, ref: r.number, who: r.department ?? nameOf(r.requestedBy), amount: purchaseTotal(r.lines), date: r.date, level: r.approval.currentLevel })),
    ...pendingClaims.filter((c) => canDecide(c.approval)).map((c) => ({ id: c.id, kind: "Expense" as const, ref: c.number, who: nameOf(c.claimantId), amount: claimTotal(c.lines), date: c.date, level: c.approval.currentLevel })),
  ];

  const decide = (kind: string, id: string, d: "Approved" | "Rejected") => {
    if (kind === "Bill") decideBill(id, d);
    else if (kind === "Requisition") decideRequisition(id, d);
    else decideClaim(id, d);
  };

  const allPending = [
    ...pendingBills.map((b) => ({ kind: "Bill", ref: b.number, amount: purchaseTotal(b.lines), status: b.approval })),
    ...pendingPRs.map((r) => ({ kind: "Requisition", ref: r.number, amount: purchaseTotal(r.lines), status: r.approval })),
    ...pendingClaims.map((c) => ({ kind: "Expense", ref: c.number, amount: claimTotal(c.lines), status: c.approval })),
  ];

  return (
    <div>
      <PageHeader title="Approvals" subtitle="Everything waiting on a financial sign-off, in one queue" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Your role" value={myRole()} tone="brand" icon={<ShieldCheck size={18} />} />
        <StatCard label="Awaiting you" value={mine.length} tone={mine.length ? "amber" : "mist"} delay={0.05} />
        <StatCard label="In the queue" value={allPending.length} tone="mist" delay={0.1} />
        <StatCard label="Value pending" value={money(allPending.reduce((n, p) => n + p.amount, 0))} tone="mist" delay={0.15} />
      </div>

      <Card className="mb-4">
        <h3 className="mb-2 text-sm font-bold text-mist-700">Awaiting your approval</h3>
        {mine.length === 0 ? <p className="text-sm text-mist-400">Nothing needs your sign-off right now.</p> : (
          <Table columns={["Type", "Reference", "For", "Amount", "Level", ""]}>
            {mine.map((m, i) => (
              <Row key={m.id} index={i}>
                <Cell><Badge tone="mist">{m.kind}</Badge></Cell>
                <Cell className="font-mono text-xs">{m.ref}</Cell>
                <Cell className="font-semibold">{m.who}</Cell>
                <Cell className="font-mono">{money(m.amount)}</Cell>
                <Cell>{m.level}</Cell>
                <Cell>
                  <div className="flex justify-end gap-1">
                    <button className="btn-primary px-2 py-1 text-xs" onClick={() => decide(m.kind, m.id, "Approved")}><Check size={11} /> Approve</button>
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => decide(m.kind, m.id, "Rejected")}><X size={11} /> Reject</button>
                  </div>
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>

      <Card className="p-0">
        <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-600">Full queue</p>
        {allPending.length === 0 ? <EmptyState title="Approval queue is empty" /> : (
          <Table columns={["Type", "Reference", "Amount", "Current level", "Progress"]}>
            {allPending.map((p, i) => (
              <Row key={i} index={i}>
                <Cell><Badge tone="mist">{p.kind}</Badge></Cell>
                <Cell className="font-mono text-xs">{p.ref}</Cell>
                <Cell className="font-mono">{money(p.amount)}</Cell>
                <Cell>{p.status.currentLevel} · {p.status.steps.find((s) => s.level === p.status.currentLevel)?.approverRole}</Cell>
                <Cell>{p.status.steps.filter((s) => s.decision === "Approved").length}/{p.status.steps.length}</Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>

      <p className="mt-4 text-sm text-mist-400">
        Configure who approves what in <Link to="/accounting/settings" className="font-semibold text-brand-700">Settings → Approval Rules <ArrowRight size={12} className="inline" /></Link>
      </p>
    </div>
  );
}
