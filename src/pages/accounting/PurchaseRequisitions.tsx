import { useState } from "react";
import { Plus, Send, Check, X, ArrowRight, ClipboardList } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, statusTone, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useAP, purchaseTotal } from "@/store/accounting/useAP";
import { useAcctControl } from "@/store/accounting/useAcctControl";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { useIdentity } from "@/store/useIdentity";
import { LineEditor, DocTotals, type EditableLine } from "./_components";
import type { PurchaseRequisition } from "@/data/accounting/payables";

const purchaseAcct = (n: number) => n >= 5000 || (n >= 1200 && n < 1600);

export default function PurchaseRequisitions() {
  const { vendors, requisitions, createRequisition, submitRequisition, decideRequisition, convertRequisitionToPO } = useAP();
  const { canDecide } = useAcctControl();
  const stockItems = useInventoryAccounting((s) => s.items).filter((i) => i.active);
  useIdentity((s) => s.user.id); // re-render on account switch
  const [create, setCreate] = useState(false);
  const [convert, setConvert] = useState<PurchaseRequisition | null>(null);
  const [convVendor, setConvVendor] = useState("");
  const [f, setF] = useState<{ department: string; vendorId: string; date: string; needBy: string; justification: string; lines: EditableLine[] }>({
    department: "", vendorId: "", date: isoDate(new Date()), needBy: "", justification: "",
    lines: [{ accountNumber: 5300, description: "", qty: 1, unitPrice: 0 }],
  });

  function submit() {
    const id = createRequisition({ vendorId: f.vendorId || undefined, department: f.department || undefined, date: new Date(f.date + "T12:00:00Z").toISOString(), needBy: f.needBy ? new Date(f.needBy + "T12:00:00Z").toISOString() : undefined, lines: f.lines.map((l) => ({ ...l, id: `pl-${Math.random().toString(36).slice(2, 7)}` })), justification: f.justification });
    submitRequisition(id);
    setCreate(false);
  }

  const myApprovals = requisitions.filter((r) => r.status === "Pending Approval" && canDecide(r.approval));

  return (
    <div>
      <PageHeader title="Purchase Requisitions" subtitle="Internal requests to buy — routed for approval by amount, then turned into a purchase order"
        actions={<Button onClick={() => setCreate(true)}><Plus size={15} /> New Requisition</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Open" value={requisitions.filter((r) => r.status === "Draft" || r.status === "Pending Approval").length} tone="brand" icon={<ClipboardList size={18} />} />
        <StatCard label="Approved" value={requisitions.filter((r) => r.status === "Approved").length} tone="brand" delay={0.05} />
        <StatCard label="Pending my approval" value={myApprovals.length} tone="amber" delay={0.1} />
        <StatCard label="Ordered" value={requisitions.filter((r) => r.status === "Ordered").length} tone="mist" delay={0.15} />
      </div>

      {myApprovals.length > 0 && (
        <Card className="mb-4 border-l-4 border-l-amber-400">
          <h3 className="mb-2 text-sm font-bold text-amber-700">Awaiting your approval</h3>
          {myApprovals.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-mist-50 px-3 py-2 text-sm">
              <span>{r.number} · {r.department} · <b>{money(purchaseTotal(r.lines))}</b> · {r.justification}</span>
              <span className="flex gap-1">
                <button className="btn-primary px-2 py-1 text-xs" onClick={() => decideRequisition(r.id, "Approved")}><Check size={11} /> Approve</button>
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => decideRequisition(r.id, "Rejected")}><X size={11} /> Reject</button>
              </span>
            </div>
          ))}
        </Card>
      )}

      {requisitions.length === 0 ? <EmptyState title="No requisitions" /> : (
        <Card className="p-0">
          <Table columns={["Number", "Dept", "Date", "Need by", "Total", "Status", ""]}>
            {requisitions.map((r, i) => (
              <Row key={r.id} index={i}>
                <Cell className="font-mono text-xs">{r.number}</Cell>
                <Cell>{r.department ?? "—"}</Cell>
                <Cell>{shortDate(r.date)}</Cell>
                <Cell>{r.needBy ? shortDate(r.needBy) : "—"}</Cell>
                <Cell className="font-mono">{money(purchaseTotal(r.lines))}</Cell>
                <Cell><Badge tone={statusTone(r.status === "Approved" || r.status === "Ordered" ? "approved" : r.status === "Rejected" ? "rejected" : "submitted")}>{r.status}</Badge></Cell>
                <Cell>
                  <div className="flex justify-end gap-1">
                    {r.status === "Draft" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => submitRequisition(r.id)}><Send size={11} /></button>}
                    {r.status === "Approved" && <button className="btn-primary px-2 py-1 text-xs" onClick={() => { setConvVendor(r.vendorId ?? vendors[0]?.id ?? ""); setConvert(r); }}>To PO <ArrowRight size={10} /></button>}
                  </div>
                </Cell>
              </Row>
            ))}
          </Table>
        </Card>
      )}

      <Modal open={create} onClose={() => setCreate(false)} title="New Purchase Requisition" wide
        footer={<><Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button><Button onClick={submit} disabled={purchaseTotal(f.lines as never) <= 0 || !f.justification.trim()}>Submit</Button></>}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Department"><Input value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} placeholder="e.g. Laboratory" /></Field>
            <Field label="Preferred vendor"><Select value={f.vendorId} onChange={(e) => setF({ ...f, vendorId: e.target.value })} options={[{ value: "", label: "Any" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]} /></Field>
            <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Need by"><Input type="date" value={f.needBy} onChange={(e) => setF({ ...f, needBy: e.target.value })} /></Field>
          </div>
          <Field label="Justification"><Input value={f.justification} onChange={(e) => setF({ ...f, justification: e.target.value })} /></Field>
          <LineEditor lines={f.lines} onChange={(lines) => setF({ ...f, lines })} accountFilter={purchaseAcct} accountLabel="Item" stockItems={stockItems} />
          <DocTotals subtotal={purchaseTotal(f.lines as never)} tax={0} total={purchaseTotal(f.lines as never)} />
        </div>
      </Modal>

      <Modal open={!!convert} onClose={() => setConvert(null)} title="Create Purchase Order"
        footer={<><Button variant="ghost" onClick={() => setConvert(null)}>Cancel</Button><Button onClick={() => { if (convert) convertRequisitionToPO(convert.id, convVendor); setConvert(null); }}>Create PO</Button></>}>
        <div className="space-y-3">
          <p className="text-sm text-mist-600">Requisition {convert?.number} — {money(convert ? purchaseTotal(convert.lines) : 0)}</p>
          <Field label="Award to vendor"><Select value={convVendor} onChange={(e) => setConvVendor(e.target.value)} options={vendors.map((v) => ({ value: v.id, label: v.name }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}
