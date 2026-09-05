import { useState } from "react";
import { Plus, Undo2 } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, statusTone, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useAR, docSubtotal, docTax, docTotal } from "@/store/accounting/useAR";
import { useLedger } from "@/store/accounting/useLedger";
import { LineEditor, DocTotals, type EditableLine } from "./_components";
import type { CreditNote } from "@/data/accounting/receivables";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function CreditNotes() {
  const { customers, creditNotes, invoicesOf, customerById, createCreditNote, applyCreditNote, refundCreditNote } = useAR();
  const cashAccts = useLedger((s) => s.accounts).filter((a) => a.subtype === "cash" || a.subtype === "bank");
  const [create, setCreate] = useState(false);
  const [act, setAct] = useState<CreditNote | null>(null);
  const [f, setF] = useState<{ customerId: string; invoiceId: string; date: string; reason: string; notes: string; lines: EditableLine[] }>({
    customerId: "", invoiceId: "", date: isoDate(new Date()), reason: "Service not rendered", notes: "",
    lines: [{ accountNumber: 4000, description: "", qty: 1, unitPrice: 0, taxRateId: "tax-vat-exempt" }],
  });
  const [applyF, setApplyF] = useState({ invoiceId: "", amount: 0, refundAccount: 1010, mode: "apply" as "apply" | "refund" });

  const remaining = (cn: CreditNote) => round2(docTotal(cn.lines) - cn.applications.reduce((n, a) => n + a.amount, 0) - cn.refundedAmount);

  function submitCreate() {
    if (!f.customerId) return;
    createCreditNote({ customerId: f.customerId, invoiceId: f.invoiceId || undefined, date: new Date(f.date + "T12:00:00Z").toISOString(), lines: f.lines.map((l) => ({ ...l, id: `sl-${Math.random().toString(36).slice(2, 7)}` })), reason: f.reason, notes: f.notes || undefined });
    setCreate(false);
  }
  function submitAct() {
    if (!act) return;
    if (applyF.mode === "apply" && applyF.invoiceId) applyCreditNote(act.id, applyF.invoiceId, Math.min(applyF.amount, remaining(act)));
    if (applyF.mode === "refund") refundCreditNote(act.id, Math.min(applyF.amount, remaining(act)), applyF.refundAccount);
    setAct(null);
  }

  const outstanding = creditNotes.reduce((n, cn) => n + remaining(cn), 0);

  return (
    <div>
      <PageHeader title="Credit Notes" subtitle="Reduce what a customer owes — posts Dr revenue / Dr VAT / Cr Accounts Receivable"
        actions={<Button onClick={() => { setF({ ...f, customerId: customers[0]?.id ?? "" }); setCreate(true); }}><Plus size={15} /> New Credit Note</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Credit notes" value={creditNotes.length} tone="brand" icon={<Undo2 size={18} />} />
        <StatCard label="Unapplied credit" value={money(outstanding)} tone="amber" delay={0.05} />
        <StatCard label="Issued this month" value={money(creditNotes.filter((c) => new Date(c.date).getUTCMonth() === new Date().getUTCMonth()).reduce((n, c) => n + docTotal(c.lines), 0))} tone="mist" delay={0.1} />
      </div>

      {creditNotes.length === 0 ? <EmptyState title="No credit notes" hint="Issue one when a service is cancelled or over-billed." /> : (
        <Card className="p-0">
          <Table columns={["Number", "Customer", "Date", "Reason", "Total", "Remaining", "Status", ""]}>
            {creditNotes.map((cn, i) => (
              <Row key={cn.id} index={i}>
                <Cell className="font-mono text-xs">{cn.number}</Cell>
                <Cell className="font-semibold">{customerById(cn.customerId)?.name}</Cell>
                <Cell>{shortDate(cn.date)}</Cell>
                <Cell className="max-w-[200px] truncate text-mist-500">{cn.reason}</Cell>
                <Cell className="font-mono">{money(docTotal(cn.lines))}</Cell>
                <Cell className="font-mono">{money(remaining(cn))}</Cell>
                <Cell><Badge tone={statusTone(cn.status === "Applied" || cn.status === "Refunded" ? "approved" : "submitted")}>{cn.status}</Badge></Cell>
                <Cell>{remaining(cn) > 0.01 && <button className="btn-primary px-2 py-1 text-xs" onClick={() => { setApplyF({ invoiceId: "", amount: remaining(cn), refundAccount: 1010, mode: "apply" }); setAct(cn); }}>Apply / refund</button>}</Cell>
              </Row>
            ))}
          </Table>
        </Card>
      )}

      <Modal open={create} onClose={() => setCreate(false)} title="New Credit Note" wide
        footer={<><Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button><Button onClick={submitCreate} disabled={!f.customerId || docTotal(f.lines as never) <= 0}>Issue credit note</Button></>}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Customer"><Select value={f.customerId} onChange={(e) => setF({ ...f, customerId: e.target.value, invoiceId: "" })} options={[{ value: "", label: "Select…" }, ...customers.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
            <Field label="Against invoice (optional)"><Select value={f.invoiceId} onChange={(e) => setF({ ...f, invoiceId: e.target.value })} options={[{ value: "", label: "None" }, ...(f.customerId ? invoicesOf(f.customerId) : []).map((i) => ({ value: i.id, label: i.number }))]} /></Field>
            <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          </div>
          <Field label="Reason"><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
          <LineEditor lines={f.lines} onChange={(lines) => setF({ ...f, lines })} />
          <DocTotals subtotal={docSubtotal(f.lines as never)} tax={docTax(f.lines as never)} total={docTotal(f.lines as never)} />
          <Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={!!act} onClose={() => setAct(null)} title={act ? `Apply ${act.number}` : ""}
        footer={<><Button variant="ghost" onClick={() => setAct(null)}>Cancel</Button><Button onClick={submitAct}>{applyF.mode === "apply" ? "Apply to invoice" : "Refund"}</Button></>}>
        {act && (
          <div className="space-y-3">
            <p className="text-sm text-mist-600">Remaining credit: <b>{money(remaining(act))}</b></p>
            <div className="flex gap-2">
              <button className={`btn-soft px-3 py-1.5 text-xs ${applyF.mode === "apply" ? "ring-2 ring-brand-400" : ""}`} onClick={() => setApplyF({ ...applyF, mode: "apply" })}>Apply to invoice</button>
              <button className={`btn-soft px-3 py-1.5 text-xs ${applyF.mode === "refund" ? "ring-2 ring-brand-400" : ""}`} onClick={() => setApplyF({ ...applyF, mode: "refund" })}>Refund in cash</button>
            </div>
            {applyF.mode === "apply" ? (
              <Field label="Invoice"><Select value={applyF.invoiceId} onChange={(e) => setApplyF({ ...applyF, invoiceId: e.target.value })} options={[{ value: "", label: "Select…" }, ...invoicesOf(act.customerId).filter((i) => i.status === "Open" || i.status === "Partially Paid" || i.status === "Overdue").map((i) => ({ value: i.id, label: i.number }))]} /></Field>
            ) : (
              <Field label="Refund from"><Select value={String(applyF.refundAccount)} onChange={(e) => setApplyF({ ...applyF, refundAccount: +e.target.value })} options={cashAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
            )}
            <Field label="Amount"><Input type="number" value={applyF.amount || ""} onChange={(e) => setApplyF({ ...applyF, amount: +e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
