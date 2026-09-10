import { useState } from "react";
import { Plus, Clock, Trash2, FileText } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useAR } from "@/store/accounting/useAR";
import { useLedger } from "@/store/accounting/useLedger";
import { useNavigate } from "react-router-dom";

export default function DelayedCharges() {
  const { customers, delayedCharges, addDelayedCharge, removeDelayedCharge, customerById } = useAR();
  const revenueAccts = useLedger((s) => s.accounts).filter((a) => a.isActive && a.number >= 4000 && a.number < 5000);
  const nav = useNavigate();
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ customerId: customers[0]?.id ?? "", date: isoDate(new Date()), accountNumber: 4000, description: "", qty: 1, unitPrice: 0, taxRateId: "tax-vat-exempt" });

  const unbilled = delayedCharges.filter((d) => d.status === "Unbilled");
  const unbilledValue = unbilled.reduce((n, d) => n + d.qty * d.unitPrice, 0);
  const byCustomer = customers.map((c) => ({ c, charges: unbilled.filter((d) => d.customerId === c.id) })).filter((x) => x.charges.length);

  return (
    <div>
      <PageHeader title="Delayed Charges" subtitle="Billable items parked against a customer — no ledger impact until you pull them into an invoice"
        actions={<Button onClick={() => setModal(true)}><Plus size={15} /> Add Charge</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Unbilled charges" value={unbilled.length} tone="amber" icon={<Clock size={18} />} />
        <StatCard label="Unbilled value" value={money(unbilledValue)} tone="brand" delay={0.05} />
        <StatCard label="Customers affected" value={byCustomer.length} tone="mist" delay={0.1} />
      </div>

      {delayedCharges.length === 0 ? <EmptyState title="No delayed charges" hint="Add a billable charge now, invoice it later." /> : (
        <div className="space-y-4">
          {byCustomer.map(({ c, charges }) => (
            <Card key={c.id} className="p-0">
              <div className="flex items-center justify-between border-b border-mist-100 px-4 py-2.5">
                <span className="font-bold text-mist-700">{c.name} · {money(charges.reduce((n, d) => n + d.qty * d.unitPrice, 0))} unbilled</span>
                <Button variant="soft" onClick={() => nav(`/accounting/invoices?customer=${c.id}&pullCharges=1`)}><FileText size={13} /> Invoice these</Button>
              </div>
              <Table columns={["Date", "Description", "Account", "Qty", "Unit", "Amount", ""]}>
                {charges.map((d, i) => (
                  <Row key={d.id} index={i}>
                    <Cell className="whitespace-nowrap text-mist-500">{shortDate(d.date)}</Cell>
                    <Cell>{d.description}</Cell>
                    <Cell className="font-mono text-xs">{d.accountNumber}</Cell>
                    <Cell>{d.qty}</Cell>
                    <Cell className="font-mono">{money(d.unitPrice)}</Cell>
                    <Cell className="font-mono font-semibold">{money(d.qty * d.unitPrice)}</Cell>
                    <Cell><button className="text-action-500 hover:text-action-700" onClick={() => removeDelayedCharge(d.id)}><Trash2 size={14} /></button></Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          ))}
          {delayedCharges.some((d) => d.status === "Invoiced") && (
            <Card className="p-0">
              <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-500">Already invoiced</p>
              <Table columns={["Date", "Customer", "Description", "Amount", "Invoice"]}>
                {delayedCharges.filter((d) => d.status === "Invoiced").map((d, i) => (
                  <Row key={d.id} index={i}>
                    <Cell className="text-mist-500">{shortDate(d.date)}</Cell>
                    <Cell>{customerById(d.customerId)?.name}</Cell>
                    <Cell>{d.description}</Cell>
                    <Cell className="font-mono">{money(d.qty * d.unitPrice)}</Cell>
                    <Cell><Badge tone="brand">billed</Badge></Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          )}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Add Delayed Charge"
        footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
          <Button disabled={!f.customerId || !f.description || f.unitPrice <= 0} onClick={() => { addDelayedCharge({ ...f, date: new Date(f.date).toISOString() }); setModal(false); setF({ ...f, description: "", qty: 1, unitPrice: 0 }); }}>Add</Button></>}>
        <div className="space-y-3">
          <Field label="Customer"><Select value={f.customerId} onChange={(e) => setF({ ...f, customerId: e.target.value })} options={customers.map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Revenue account"><Select value={String(f.accountNumber)} onChange={(e) => setF({ ...f, accountNumber: +e.target.value })} options={revenueAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
          </div>
          <Field label="Description"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Quantity"><Input type="number" value={f.qty || ""} onChange={(e) => setF({ ...f, qty: +e.target.value })} /></Field>
            <Field label="Unit price"><Input type="number" value={f.unitPrice || ""} onChange={(e) => setF({ ...f, unitPrice: +e.target.value })} /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
