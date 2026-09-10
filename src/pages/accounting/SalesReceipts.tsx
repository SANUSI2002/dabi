import { useState } from "react";
import { Plus, Banknote, Undo2, Ban } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, EmptyState, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useAR, docSubtotal, docTax, docTotal } from "@/store/accounting/useAR";
import { useLedger } from "@/store/accounting/useLedger";
import { LineEditor, DocTotals, type EditableLine } from "./_components";

export default function SalesReceipts() {
  const { customers, salesReceipts, refundReceipts, createSalesReceipt, voidSalesReceipt, createRefundReceipt, voidRefundReceipt, customerById } = useAR();
  const cashAccts = useLedger((s) => s.accounts).filter((a) => a.subtype === "cash" || a.subtype === "bank");
  const [saleModal, setSaleModal] = useState(false);
  const [refundModal, setRefundModal] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [sf, setSf] = useState<{ customerId: string; customerName: string; date: string; method: string; deposit: number; lines: EditableLine[]; notes: string }>({
    customerId: "", customerName: "", date: isoDate(new Date()), method: "POS", deposit: 1010, lines: [{ accountNumber: 4000, description: "", qty: 1, unitPrice: 0, taxRateId: "tax-vat-exempt" }], notes: "",
  });
  const [rf, setRf] = useState<{ customerId: string; date: string; method: string; from: number; lines: EditableLine[]; reason: string }>({
    customerId: customers[0]?.id ?? "", date: isoDate(new Date()), method: "Bank Transfer", from: 1010, lines: [{ accountNumber: 4000, description: "", qty: 1, unitPrice: 0, taxRateId: "tax-vat-exempt" }], reason: "",
  });

  const monthSales = salesReceipts.filter((s) => s.status === "Completed" && new Date(s.date).getMonth() === new Date().getMonth()).reduce((n, s) => n + docTotal(s.lines), 0);
  const totalRefunds = refundReceipts.filter((r) => r.status === "Completed").reduce((n, r) => n + docTotal(r.lines), 0);

  return (
    <div>
      <PageHeader title="Cash Sales & Refunds" subtitle="Over-the-counter sales settled on the spot, and money refunded to customers — no invoice, straight to the ledger"
        actions={<>
          <Button variant="soft" onClick={() => { setErr(null); setRefundModal(true); }}><Undo2 size={15} /> Refund</Button>
          <Button onClick={() => { setErr(null); setSaleModal(true); }}><Plus size={15} /> Cash Sale</Button>
        </>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Cash sales (month)" value={money(monthSales)} tone="brand" icon={<Banknote size={18} />} />
        <StatCard label="Receipts" value={salesReceipts.filter((s) => s.status === "Completed").length} tone="mist" delay={0.05} />
        <StatCard label="Refunds issued" value={money(totalRefunds)} tone="action" delay={0.1} />
      </div>

      <Tabs tabs={["Cash Sales", "Refunds"]}>
        {(t) =>
          t === "Refunds" ? (
            refundReceipts.length === 0 ? <EmptyState title="No refunds" hint="Refund a customer for a returned service or an overpayment." /> : (
              <Card className="p-0">
                <Table columns={["Number", "Customer", "Date", "Reason", "Amount", "Status", ""]}>
                  {refundReceipts.map((r, i) => (
                    <Row key={r.id} index={i}>
                      <Cell className="font-mono text-xs">{r.number}</Cell>
                      <Cell className="font-semibold">{customerById(r.customerId)?.name ?? "—"}</Cell>
                      <Cell>{shortDate(r.date)}</Cell>
                      <Cell className="max-w-[240px] truncate text-mist-500">{r.reason}</Cell>
                      <Cell className="font-mono">{money(docTotal(r.lines))}</Cell>
                      <Cell><Badge tone={r.status === "Void" ? "mist" : "action"}>{r.status}</Badge></Cell>
                      <Cell>{r.status === "Completed" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => voidRefundReceipt(r.id)}><Ban size={11} /> Void</button>}</Cell>
                    </Row>
                  ))}
                </Table>
              </Card>
            )
          ) : salesReceipts.length === 0 ? <EmptyState title="No cash sales yet" /> : (
            <Card className="p-0">
              <Table columns={["Number", "Customer", "Date", "Method", "Items", "Amount", "Status", ""]}>
                {salesReceipts.map((s, i) => (
                  <Row key={s.id} index={i}>
                    <Cell className="font-mono text-xs">{s.number}</Cell>
                    <Cell className="font-semibold">{s.customerName ?? customerById(s.customerId)?.name ?? "Cash customer"}</Cell>
                    <Cell>{shortDate(s.date)}</Cell>
                    <Cell><Badge tone="mist">{s.method}</Badge></Cell>
                    <Cell className="max-w-[220px] truncate text-mist-500">{s.lines.map((l) => l.description).join(", ")}</Cell>
                    <Cell className="font-mono font-semibold">{money(docTotal(s.lines))}</Cell>
                    <Cell><Badge tone={s.status === "Void" ? "mist" : statusTone("completed")}>{s.status}</Badge></Cell>
                    <Cell>{s.status === "Completed" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => voidSalesReceipt(s.id)}><Ban size={11} /> Void</button>}</Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          )
        }
      </Tabs>

      {/* cash sale */}
      <Modal open={saleModal} onClose={() => setSaleModal(false)} title="Record a Cash Sale" wide
        footer={<><Button variant="ghost" onClick={() => setSaleModal(false)}>Cancel</Button>
          <Button onClick={() => {
            const res = createSalesReceipt({ customerId: sf.customerId || undefined, customerName: sf.customerId ? undefined : (sf.customerName || "Cash customer"), date: new Date(sf.date).toISOString(), method: sf.method as never, depositAccountNumber: sf.deposit, lines: sf.lines.map((l) => ({ ...l, id: l.id ?? "" })), notes: sf.notes || undefined });
            if (!res.ok) return setErr(res.error ?? "Could not record.");
            setSaleModal(false); setSf({ ...sf, customerName: "", lines: [{ accountNumber: 4000, description: "", qty: 1, unitPrice: 0, taxRateId: "tax-vat-exempt" }], notes: "" });
          }}>Record & post</Button></>}>
        <div className="space-y-3">
          {err && <div className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700">{err}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Customer (optional)"><Select value={sf.customerId} onChange={(e) => setSf({ ...sf, customerId: e.target.value })} options={[{ value: "", label: "Walk-in — no record" }, ...customers.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
            {!sf.customerId && <Field label="Name on receipt"><Input value={sf.customerName} onChange={(e) => setSf({ ...sf, customerName: e.target.value })} placeholder="Walk-in customer" /></Field>}
            <Field label="Date"><Input type="date" value={sf.date} onChange={(e) => setSf({ ...sf, date: e.target.value })} /></Field>
            <Field label="Method"><Select value={sf.method} onChange={(e) => setSf({ ...sf, method: e.target.value })} options={["Cash", "Bank Transfer", "POS", "Cheque"]} /></Field>
            <Field label="Deposit to"><Select value={String(sf.deposit)} onChange={(e) => setSf({ ...sf, deposit: +e.target.value })} options={cashAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
          </div>
          <LineEditor lines={sf.lines} onChange={(lines) => setSf({ ...sf, lines })} />
          <DocTotals subtotal={docSubtotal(sf.lines as never)} tax={docTax(sf.lines as never)} total={docTotal(sf.lines as never)} />
          <Field label="Notes"><Textarea value={sf.notes} onChange={(e) => setSf({ ...sf, notes: e.target.value })} /></Field>
        </div>
      </Modal>

      {/* refund */}
      <Modal open={refundModal} onClose={() => setRefundModal(false)} title="Refund a Customer" wide
        footer={<><Button variant="ghost" onClick={() => setRefundModal(false)}>Cancel</Button>
          <Button onClick={() => {
            const res = createRefundReceipt({ customerId: rf.customerId, date: new Date(rf.date).toISOString(), method: rf.method as never, fromAccountNumber: rf.from, lines: rf.lines.map((l) => ({ ...l, id: l.id ?? "" })), reason: rf.reason });
            if (!res.ok) return setErr(res.error ?? "Could not refund.");
            setRefundModal(false); setRf({ ...rf, lines: [{ accountNumber: 4000, description: "", qty: 1, unitPrice: 0, taxRateId: "tax-vat-exempt" }], reason: "" });
          }} disabled={!rf.customerId || !rf.reason}>Refund & post</Button></>}>
        <div className="space-y-3">
          {err && <div className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700">{err}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Customer"><Select value={rf.customerId} onChange={(e) => setRf({ ...rf, customerId: e.target.value })} options={customers.map((c) => ({ value: c.id, label: c.name }))} /></Field>
            <Field label="Date"><Input type="date" value={rf.date} onChange={(e) => setRf({ ...rf, date: e.target.value })} /></Field>
            <Field label="Method"><Select value={rf.method} onChange={(e) => setRf({ ...rf, method: e.target.value })} options={["Cash", "Bank Transfer", "POS", "Cheque"]} /></Field>
            <Field label="Pay from"><Select value={String(rf.from)} onChange={(e) => setRf({ ...rf, from: +e.target.value })} options={cashAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
          </div>
          <LineEditor lines={rf.lines} onChange={(lines) => setRf({ ...rf, lines })} accountLabel="Refunded service" />
          <DocTotals subtotal={docSubtotal(rf.lines as never)} tax={docTax(rf.lines as never)} total={docTotal(rf.lines as never)} />
          <Field label="Reason"><Input value={rf.reason} onChange={(e) => setRf({ ...rf, reason: e.target.value })} placeholder="e.g. cancelled procedure, overpayment" /></Field>
        </div>
      </Modal>
    </div>
  );
}
