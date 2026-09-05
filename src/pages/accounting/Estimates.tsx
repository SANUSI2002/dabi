import { useState } from "react";
import { Plus, Send, Check, X, ArrowRight } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, statusTone, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useAR, docSubtotal, docTax, docTotal } from "@/store/accounting/useAR";
import { LineEditor, DocTotals, type EditableLine } from "./_components";

export default function Estimates() {
  const { customers, estimates, customerById, createEstimate, setEstimateStatus, convertEstimateToOrder, convertEstimateToInvoice } = useAR();
  const [create, setCreate] = useState(false);
  const [f, setF] = useState<{ customerId: string; date: string; expiryDays: number; notes: string; lines: EditableLine[] }>({
    customerId: "", date: isoDate(new Date()), expiryDays: 30, notes: "",
    lines: [{ accountNumber: 4000, description: "", qty: 1, unitPrice: 0, taxRateId: "tax-vat-exempt" }],
  });

  function submit() {
    if (!f.customerId) return;
    createEstimate({ customerId: f.customerId, date: new Date(f.date + "T12:00:00Z").toISOString(), expiryDays: f.expiryDays, lines: f.lines.map((l) => ({ ...l, id: `sl-${Math.random().toString(36).slice(2, 7)}` })), notes: f.notes || undefined });
    setCreate(false);
  }

  return (
    <div>
      <PageHeader title="Quotations / Estimates" subtitle="Priced offers to customers — accept to turn into a sales order or an invoice"
        actions={<Button onClick={() => { setF({ ...f, customerId: customers[0]?.id ?? "" }); setCreate(true); }}><Plus size={15} /> New Quotation</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Open" value={estimates.filter((e) => e.status === "Draft" || e.status === "Sent").length} tone="brand" />
        <StatCard label="Accepted" value={estimates.filter((e) => e.status === "Accepted").length} tone="brand" delay={0.05} />
        <StatCard label="Converted" value={estimates.filter((e) => e.status === "Converted").length} tone="mist" delay={0.1} />
        <StatCard label="Pipeline value" value={money(estimates.filter((e) => e.status === "Sent" || e.status === "Accepted").reduce((n, e) => n + docTotal(e.lines), 0))} tone="mist" delay={0.15} />
      </div>

      {estimates.length === 0 ? <EmptyState title="No quotations yet" /> : (
        <Card className="p-0">
          <Table columns={["Number", "Customer", "Date", "Expires", "Total", "Status", ""]}>
            {estimates.map((e, i) => (
              <Row key={e.id} index={i}>
                <Cell className="font-mono text-xs">{e.number}</Cell>
                <Cell className="font-semibold">{customerById(e.customerId)?.name}</Cell>
                <Cell>{shortDate(e.date)}</Cell>
                <Cell>{shortDate(e.expiryDate)}</Cell>
                <Cell className="font-mono">{money(docTotal(e.lines))}</Cell>
                <Cell><Badge tone={statusTone(e.status === "Accepted" || e.status === "Converted" ? "approved" : e.status === "Declined" ? "rejected" : "submitted")}>{e.status}</Badge></Cell>
                <Cell>
                  <div className="flex justify-end gap-1">
                    {e.status === "Draft" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEstimateStatus(e.id, "Sent")}><Send size={11} /></button>}
                    {e.status === "Sent" && <>
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEstimateStatus(e.id, "Accepted")}><Check size={11} /></button>
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEstimateStatus(e.id, "Declined")}><X size={11} /></button>
                    </>}
                    {e.status === "Accepted" && <>
                      <button className="btn-soft px-2 py-1 text-xs" onClick={() => convertEstimateToOrder(e.id)}>To order</button>
                      <button className="btn-primary px-2 py-1 text-xs" onClick={() => convertEstimateToInvoice(e.id)}>To invoice <ArrowRight size={10} /></button>
                    </>}
                  </div>
                </Cell>
              </Row>
            ))}
          </Table>
        </Card>
      )}

      <Modal open={create} onClose={() => setCreate(false)} title="New Quotation" wide
        footer={<><Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button><Button onClick={submit} disabled={!f.customerId || docTotal(f.lines as never) <= 0}>Create</Button></>}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Customer"><Select value={f.customerId} onChange={(e) => setF({ ...f, customerId: e.target.value })} options={[{ value: "", label: "Select…" }, ...customers.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
            <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Valid for (days)"><Input type="number" value={f.expiryDays} onChange={(e) => setF({ ...f, expiryDays: +e.target.value })} /></Field>
          </div>
          <LineEditor lines={f.lines} onChange={(lines) => setF({ ...f, lines })} />
          <DocTotals subtotal={docSubtotal(f.lines as never)} tax={docTax(f.lines as never)} total={docTotal(f.lines as never)} />
          <Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
