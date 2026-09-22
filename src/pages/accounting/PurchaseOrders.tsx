import { useState } from "react";
import { Plus, Send, PackageCheck, FileText, X } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, statusTone, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useAP, purchaseTotal } from "@/store/accounting/useAP";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { LineEditor, DocTotals, type EditableLine } from "./_components";
import type { PurchaseOrder } from "@/data/accounting/payables";

const purchaseAcct = (n: number) => n >= 5000 || (n >= 1200 && n < 1600);

export default function PurchaseOrders() {
  const { vendors, purchaseOrders, vendorById, createPurchaseOrder, sendPurchaseOrder, cancelPurchaseOrder, receiveGoods, convertPOToBill } = useAP();
  const stockItems = useInventoryAccounting((s) => s.items).filter((i) => i.active);
  const [create, setCreate] = useState(false);
  const [receive, setReceive] = useState<PurchaseOrder | null>(null);
  const [rcv, setRcv] = useState<Record<string, number>>({});
  const [f, setF] = useState<{ vendorId: string; date: string; expectedDate: string; notes: string; lines: EditableLine[] }>({
    vendorId: "", date: isoDate(new Date()), expectedDate: "", notes: "",
    lines: [{ accountNumber: 1200, description: "", qty: 1, unitPrice: 0 }],
  });

  function submit() {
    if (!f.vendorId) return;
    createPurchaseOrder({ vendorId: f.vendorId, date: new Date(f.date + "T12:00:00Z").toISOString(), expectedDate: f.expectedDate ? new Date(f.expectedDate + "T12:00:00Z").toISOString() : undefined, lines: f.lines.map((l) => ({ ...l, id: `pl-${Math.random().toString(36).slice(2, 7)}` })), notes: f.notes || undefined });
    setCreate(false);
  }
  function submitReceive() {
    if (!receive) return;
    receiveGoods(receive.id, receive.lines.map((l) => ({ poLineId: l.id, qtyReceived: rcv[l.id] ?? l.qty })));
    setReceive(null);
    setRcv({});
  }

  return (
    <div>
      <PageHeader title="Purchase Orders" subtitle="Commitments to buy from a vendor — receive goods, then convert to a bill"
        actions={<Button onClick={() => { setF({ ...f, vendorId: vendors[0]?.id ?? "" }); setCreate(true); }}><Plus size={15} /> New Purchase Order</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Open" value={purchaseOrders.filter((o) => o.status === "Draft" || o.status === "Sent" || o.status === "Partially Received").length} tone="brand" icon={<FileText size={18} />} />
        <StatCard label="Received" value={purchaseOrders.filter((o) => o.status === "Received").length} tone="brand" delay={0.05} />
        <StatCard label="Billed" value={purchaseOrders.filter((o) => o.status === "Billed").length} tone="mist" delay={0.1} />
        <StatCard label="Committed value" value={money(purchaseOrders.filter((o) => o.status !== "Cancelled" && o.status !== "Billed").reduce((n, o) => n + purchaseTotal(o.lines), 0))} tone="mist" delay={0.15} />
      </div>

      {purchaseOrders.length === 0 ? <EmptyState title="No purchase orders" hint="Raise one directly or from an approved requisition." /> : (
        <Card className="p-0">
          <Table columns={["PO", "Vendor", "Date", "Expected", "Total", "Status", ""]}>
            {purchaseOrders.map((o, i) => (
              <Row key={o.id} index={i}>
                <Cell className="font-mono text-xs">{o.number}</Cell>
                <Cell className="font-semibold">{vendorById(o.vendorId)?.name}</Cell>
                <Cell>{shortDate(o.date)}</Cell>
                <Cell>{o.expectedDate ? shortDate(o.expectedDate) : "—"}</Cell>
                <Cell className="font-mono">{money(purchaseTotal(o.lines))}</Cell>
                <Cell><Badge tone={statusTone(o.status === "Received" || o.status === "Billed" ? "approved" : o.status === "Cancelled" ? "rejected" : "submitted")}>{o.status}</Badge></Cell>
                <Cell>
                  <div className="flex justify-end gap-1">
                    {o.status === "Draft" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => sendPurchaseOrder(o.id)}><Send size={11} /></button>}
                    {(o.status === "Sent" || o.status === "Partially Received") && <button className="btn-soft px-2 py-1 text-xs" onClick={() => { setRcv({}); setReceive(o); }}><PackageCheck size={11} /> Receive</button>}
                    {(o.status === "Received" || o.status === "Partially Received") && <button className="btn-primary px-2 py-1 text-xs" onClick={() => convertPOToBill(o.id)}>To bill</button>}
                    {(o.status === "Draft" || o.status === "Sent") && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => cancelPurchaseOrder(o.id)}><X size={11} /></button>}
                  </div>
                </Cell>
              </Row>
            ))}
          </Table>
        </Card>
      )}

      <Modal open={create} onClose={() => setCreate(false)} title="New Purchase Order" wide
        footer={<><Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button><Button onClick={submit} disabled={!f.vendorId || purchaseTotal(f.lines as never) <= 0}>Create</Button></>}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Vendor"><Select value={f.vendorId} onChange={(e) => setF({ ...f, vendorId: e.target.value })} options={[{ value: "", label: "Select…" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]} /></Field>
            <Field label="Order date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Expected delivery"><Input type="date" value={f.expectedDate} onChange={(e) => setF({ ...f, expectedDate: e.target.value })} /></Field>
          </div>
          <LineEditor lines={f.lines} onChange={(lines) => setF({ ...f, lines })} accountFilter={purchaseAcct} accountLabel="Item" stockItems={stockItems} />
          <DocTotals subtotal={purchaseTotal(f.lines as never)} tax={0} total={purchaseTotal(f.lines as never)} />
          <Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={!!receive} onClose={() => setReceive(null)} title={receive ? `Receive against ${receive.number}` : ""}
        footer={<><Button variant="ghost" onClick={() => setReceive(null)}>Cancel</Button><Button onClick={submitReceive}>Record receipt</Button></>}>
        {receive && (
          <Table columns={["Item", "Ordered", "Receiving now"]}>
            {receive.lines.map((l, i) => (
              <Row key={l.id} index={i}>
                <Cell>{l.description}</Cell>
                <Cell>{l.qty}</Cell>
                <Cell><input type="number" className="input h-8 w-24 text-sm" value={rcv[l.id] ?? l.qty} onChange={(e) => setRcv({ ...rcv, [l.id]: +e.target.value })} /></Cell>
              </Row>
            ))}
          </Table>
        )}
      </Modal>
    </div>
  );
}
