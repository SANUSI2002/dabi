import { useState } from "react";
import { Plus, Undo2 } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, statusTone, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useAP, purchaseSubtotal, purchaseTax, purchaseTotal } from "@/store/accounting/useAP";
import { LineEditor, DocTotals, type EditableLine } from "./_components";
import type { VendorCredit } from "@/data/accounting/payables";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const purchaseAcct = (n: number) => n >= 5000 || (n >= 1200 && n < 1600);

export default function VendorCredits() {
  const { vendors, vendorCredits, billsOf, vendorById, createVendorCredit, applyVendorCredit } = useAP();
  const [create, setCreate] = useState(false);
  const [apply, setApply] = useState<VendorCredit | null>(null);
  const [applyF, setApplyF] = useState({ billId: "", amount: 0 });
  const [f, setF] = useState<{ vendorId: string; billId: string; date: string; reason: string; lines: EditableLine[] }>({
    vendorId: "", billId: "", date: isoDate(new Date()), reason: "Goods returned",
    lines: [{ accountNumber: 1200, description: "", qty: 1, unitPrice: 0 }],
  });

  const remaining = (vc: VendorCredit) => round2(purchaseTotal(vc.lines) - vc.applications.reduce((n, a) => n + a.amount, 0));

  function submitCreate() {
    if (!f.vendorId) return;
    createVendorCredit({ vendorId: f.vendorId, billId: f.billId || undefined, date: new Date(f.date + "T12:00:00Z").toISOString(), lines: f.lines.map((l) => ({ ...l, id: `pl-${Math.random().toString(36).slice(2, 7)}` })), reason: f.reason });
    setCreate(false);
  }

  return (
    <div>
      <PageHeader title="Vendor Credits" subtitle="Credits from vendors (returns, overcharges) — posts Dr Accounts Payable / Cr expense/inventory"
        actions={<Button onClick={() => { setF({ ...f, vendorId: vendors[0]?.id ?? "" }); setCreate(true); }}><Plus size={15} /> New Vendor Credit</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Vendor credits" value={vendorCredits.length} tone="brand" icon={<Undo2 size={18} />} />
        <StatCard label="Unapplied" value={money(vendorCredits.reduce((n, vc) => n + remaining(vc), 0))} tone="amber" delay={0.05} />
        <StatCard label="This month" value={money(vendorCredits.filter((c) => new Date(c.date).getUTCMonth() === new Date().getUTCMonth()).reduce((n, c) => n + purchaseTotal(c.lines), 0))} tone="mist" delay={0.1} />
      </div>

      {vendorCredits.length === 0 ? <EmptyState title="No vendor credits" /> : (
        <Card className="p-0">
          <Table columns={["Number", "Vendor", "Date", "Reason", "Total", "Remaining", "Status", ""]}>
            {vendorCredits.map((vc, i) => (
              <Row key={vc.id} index={i}>
                <Cell className="font-mono text-xs">{vc.number}</Cell>
                <Cell className="font-semibold">{vendorById(vc.vendorId)?.name}</Cell>
                <Cell>{shortDate(vc.date)}</Cell>
                <Cell className="max-w-[180px] truncate text-mist-500">{vc.reason}</Cell>
                <Cell className="font-mono">{money(purchaseTotal(vc.lines))}</Cell>
                <Cell className="font-mono">{money(remaining(vc))}</Cell>
                <Cell><Badge tone={statusTone(vc.status === "Applied" ? "approved" : "submitted")}>{vc.status}</Badge></Cell>
                <Cell>{remaining(vc) > 0.01 && <button className="btn-primary px-2 py-1 text-xs" onClick={() => { setApplyF({ billId: "", amount: remaining(vc) }); setApply(vc); }}>Apply</button>}</Cell>
              </Row>
            ))}
          </Table>
        </Card>
      )}

      <Modal open={create} onClose={() => setCreate(false)} title="New Vendor Credit" wide
        footer={<><Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button><Button onClick={submitCreate} disabled={!f.vendorId || purchaseTotal(f.lines as never) <= 0}>Record</Button></>}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Vendor"><Select value={f.vendorId} onChange={(e) => setF({ ...f, vendorId: e.target.value, billId: "" })} options={[{ value: "", label: "Select…" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]} /></Field>
            <Field label="Against bill (optional)"><Select value={f.billId} onChange={(e) => setF({ ...f, billId: e.target.value })} options={[{ value: "", label: "None" }, ...(f.vendorId ? billsOf(f.vendorId) : []).map((b) => ({ value: b.id, label: b.number }))]} /></Field>
            <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          </div>
          <Field label="Reason"><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
          <LineEditor lines={f.lines} onChange={(lines) => setF({ ...f, lines })} accountFilter={purchaseAcct} accountLabel="Item" />
          <DocTotals subtotal={purchaseSubtotal(f.lines as never)} tax={purchaseTax(f.lines as never)} total={purchaseTotal(f.lines as never)} />
        </div>
      </Modal>

      <Modal open={!!apply} onClose={() => setApply(null)} title={apply ? `Apply ${apply.number}` : ""}
        footer={<><Button variant="ghost" onClick={() => setApply(null)}>Cancel</Button><Button onClick={() => { if (apply && applyF.billId) applyVendorCredit(apply.id, applyF.billId, Math.min(applyF.amount, remaining(apply))); setApply(null); }}>Apply to bill</Button></>}>
        {apply && (
          <div className="space-y-3">
            <p className="text-sm text-mist-600">Remaining: <b>{money(remaining(apply))}</b></p>
            <Field label="Bill"><Select value={applyF.billId} onChange={(e) => setApplyF({ ...applyF, billId: e.target.value })} options={[{ value: "", label: "Select…" }, ...billsOf(apply.vendorId).filter((b) => b.status === "Awaiting Payment" || b.status === "Partially Paid" || b.status === "Overdue").map((b) => ({ value: b.id, label: b.number }))]} /></Field>
            <Field label="Amount"><Input type="number" value={applyF.amount || ""} onChange={(e) => setApplyF({ ...applyF, amount: +e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
