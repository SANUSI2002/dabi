import { useState } from "react";
import { Plus, Check, X, ArrowRight } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, statusTone, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useAR, docSubtotal, docTax, docTotal } from "@/store/accounting/useAR";
import { LineEditor, DocTotals, type EditableLine } from "./_components";

export default function SalesOrders() {
  const { customers, salesOrders, customerById, createSalesOrder, confirmSalesOrder, cancelSalesOrder, convertOrderToInvoice } = useAR();
  const [create, setCreate] = useState(false);
  const [f, setF] = useState<{ customerId: string; date: string; notes: string; lines: EditableLine[] }>({
    customerId: "", date: isoDate(new Date()), notes: "",
    lines: [{ accountNumber: 4000, description: "", qty: 1, unitPrice: 0, taxRateId: "tax-vat-exempt" }],
  });

  function submit() {
    if (!f.customerId) return;
    createSalesOrder({ customerId: f.customerId, date: new Date(f.date + "T12:00:00Z").toISOString(), lines: f.lines.map((l) => ({ ...l, id: `sl-${Math.random().toString(36).slice(2, 7)}` })), notes: f.notes || undefined });
    setCreate(false);
  }

  return (
    <div>
      <PageHeader title="Sales Orders" subtitle="Confirmed customer orders awaiting fulfilment and invoicing"
        actions={<Button onClick={() => { setF({ ...f, customerId: customers[0]?.id ?? "" }); setCreate(true); }}><Plus size={15} /> New Sales Order</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Draft" value={salesOrders.filter((o) => o.status === "Draft").length} tone="amber" />
        <StatCard label="Confirmed" value={salesOrders.filter((o) => o.status === "Confirmed").length} tone="brand" delay={0.05} />
        <StatCard label="Order book value" value={money(salesOrders.filter((o) => o.status === "Confirmed").reduce((n, o) => n + docTotal(o.lines), 0))} tone="mist" delay={0.1} />
      </div>

      {salesOrders.length === 0 ? <EmptyState title="No sales orders" hint="Create one directly or from an accepted quotation." /> : (
        <Card className="p-0">
          <Table columns={["Number", "Customer", "Date", "Total", "Status", ""]}>
            {salesOrders.map((o, i) => (
              <Row key={o.id} index={i}>
                <Cell className="font-mono text-xs">{o.number}</Cell>
                <Cell className="font-semibold">{customerById(o.customerId)?.name}</Cell>
                <Cell>{shortDate(o.date)}</Cell>
                <Cell className="font-mono">{money(docTotal(o.lines))}</Cell>
                <Cell><Badge tone={statusTone(o.status === "Confirmed" || o.status === "Converted" ? "approved" : o.status === "Cancelled" ? "rejected" : "submitted")}>{o.status}</Badge></Cell>
                <Cell>
                  <div className="flex justify-end gap-1">
                    {o.status === "Draft" && <>
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => confirmSalesOrder(o.id)}><Check size={11} /></button>
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => cancelSalesOrder(o.id)}><X size={11} /></button>
                    </>}
                    {o.status === "Confirmed" && <button className="btn-primary px-2 py-1 text-xs" onClick={() => convertOrderToInvoice(o.id)}>To invoice <ArrowRight size={10} /></button>}
                  </div>
                </Cell>
              </Row>
            ))}
          </Table>
        </Card>
      )}

      <Modal open={create} onClose={() => setCreate(false)} title="New Sales Order" wide
        footer={<><Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button><Button onClick={submit} disabled={!f.customerId || docTotal(f.lines as never) <= 0}>Create</Button></>}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Customer"><Select value={f.customerId} onChange={(e) => setF({ ...f, customerId: e.target.value })} options={[{ value: "", label: "Select…" }, ...customers.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
            <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          </div>
          <LineEditor lines={f.lines} onChange={(lines) => setF({ ...f, lines })} />
          <DocTotals subtotal={docSubtotal(f.lines as never)} tax={docTax(f.lines as never)} total={docTotal(f.lines as never)} />
          <Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
