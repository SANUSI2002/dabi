import { useMemo, useState } from "react";
import { Plus, Send, Check, X, Ban, Banknote, FileText } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, statusTone, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useAP, purchaseSubtotal, purchaseTax, purchaseTotal } from "@/store/accounting/useAP";
import { useAcctControl } from "@/store/accounting/useAcctControl";
import { useLedger } from "@/store/accounting/useLedger";
import { useIdentity } from "@/store/useIdentity";
import { LineEditor, DocTotals, type EditableLine } from "./_components";
import type { Bill } from "@/data/accounting/payables";

const purchaseAcct = (n: number) => n >= 5000 || (n >= 1200 && n < 1600) || n === 2100;

export default function Bills() {
  const { vendors, bills, vendorById, createBill, submitBill, decideBill, postBill, voidBill, payVendor, billBalance } = useAP();
  const { canDecide, can } = useAcctControl();
  useIdentity((s) => s.user.id); // re-render on account switch so approval inbox refreshes
  const cashAccts = useLedger((s) => s.accounts).filter((a) => a.subtype === "cash" || a.subtype === "bank");

  const [create, setCreate] = useState(false);
  const [view, setView] = useState<Bill | null>(null);
  const [pay, setPay] = useState<Bill | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [f, setF] = useState<{ vendorId: string; vendorInvoiceNumber: string; date: string; dueDate: string; notes: string; lines: EditableLine[] }>({
    vendorId: vendors[0]?.id ?? "", vendorInvoiceNumber: "", date: isoDate(new Date()), dueDate: isoDate(new Date(Date.now() + 30 * 864e5)), notes: "",
    lines: [{ accountNumber: 5100, description: "", qty: 1, unitPrice: 0, taxRateId: "tax-vat-exempt" }],
  });
  const [payF, setPayF] = useState({ date: isoDate(new Date()), method: "Bank Transfer" as const, account: 1010, amount: 0, reference: "", wht: 0 });

  function submitCreate(submitForApproval: boolean) {
    setErr(null);
    if (!f.vendorId) return setErr("Pick a vendor.");
    const id = createBill({ vendorId: f.vendorId, vendorInvoiceNumber: f.vendorInvoiceNumber || undefined, date: new Date(f.date + "T12:00:00Z").toISOString(), dueDate: new Date(f.dueDate + "T12:00:00Z").toISOString(), lines: f.lines.map((l) => ({ ...l, id: `pl-${Math.random().toString(36).slice(2, 7)}` })), notes: f.notes || undefined });
    if (submitForApproval) submitBill(id);
    setCreate(false);
  }

  function submitPay() {
    if (!pay) return;
    setErr(null);
    const r = payVendor({
      vendorId: pay.vendorId,
      date: new Date(payF.date + "T12:00:00Z").toISOString(),
      method: payF.method,
      fromAccountNumber: payF.account,
      amount: payF.amount,
      withheldTax: payF.wht || undefined,
      allocations: [{ billId: pay.id, amount: Math.min(payF.amount + (payF.wht || 0), billBalance(pay)) }],
      reference: payF.reference || undefined,
    });
    if (!r.ok) return setErr(r.error ?? "Could not pay");
    setPay(null);
  }

  const stats = useMemo(() => {
    const live = bills.filter((b) => b.status !== "Draft" && b.status !== "Void" && b.status !== "Pending Approval");
    return {
      payable: live.reduce((n, b) => n + billBalance(b), 0),
      overdue: live.filter((b) => b.status === "Overdue").reduce((n, b) => n + billBalance(b), 0),
      pending: bills.filter((b) => b.status === "Pending Approval").length,
      draft: bills.filter((b) => b.status === "Draft").length,
    };
  }, [bills, billBalance]);

  const myApprovals = bills.filter((b) => b.status === "Pending Approval" && canDecide(b.approval));

  return (
    <div>
      <PageHeader title="Bills" subtitle="Vendor invoices — posting a bill records Dr expense/inventory / Cr Accounts Payable"
        actions={<Button onClick={() => { setErr(null); setF({ ...f, vendorId: vendors[0]?.id ?? "" }); setCreate(true); }}><Plus size={15} /> New Bill</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Payable" value={money(stats.payable)} tone="action" icon={<FileText size={18} />} />
        <StatCard label="Overdue" value={money(stats.overdue)} tone="action" delay={0.05} />
        <StatCard label="Pending approval" value={stats.pending} tone="amber" delay={0.1} />
        <StatCard label="Drafts" value={stats.draft} tone="mist" delay={0.15} />
      </div>

      {myApprovals.length > 0 && (
        <Card className="mb-4 border-l-4 border-l-amber-400">
          <h3 className="mb-2 text-sm font-bold text-amber-700">Awaiting your approval ({myApprovals.length})</h3>
          <div className="space-y-2">
            {myApprovals.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-mist-50 px-3 py-2 text-sm">
                <span>{b.number} · {vendorById(b.vendorId)?.name} · <b>{money(purchaseTotal(b.lines))}</b> · level {b.approval.currentLevel}</span>
                <span className="flex gap-1">
                  <button className="btn-primary px-2 py-1 text-xs" onClick={() => decideBill(b.id, "Approved")}><Check size={11} /> Approve</button>
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => decideBill(b.id, "Rejected")}><X size={11} /> Reject</button>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Tabs tabs={["All", "Awaiting Payment", "Overdue", "Pending Approval", "Draft", "Paid"]}>
        {(t) => {
          const list = bills.filter((b) =>
            t === "All" ? true : t === "Awaiting Payment" ? b.status === "Awaiting Payment" || b.status === "Partially Paid" : t === "Overdue" ? b.status === "Overdue" : t === "Pending Approval" ? b.status === "Pending Approval" : t === "Draft" ? b.status === "Draft" : b.status === "Paid",
          );
          if (!list.length) return <EmptyState title="No bills here" />;
          return (
            <Card className="p-0">
              <Table columns={["Bill", "Vendor", "Vendor inv.", "Date", "Due", "Total", "Balance", "Status", ""]}>
                {list.map((b, i) => (
                  <Row key={b.id} index={i} onClick={() => setView(b)}>
                    <Cell className="font-mono text-xs">{b.number}</Cell>
                    <Cell className="font-semibold">{vendorById(b.vendorId)?.name}</Cell>
                    <Cell className="text-xs text-mist-500">{b.vendorInvoiceNumber ?? "—"}</Cell>
                    <Cell>{shortDate(b.date)}</Cell>
                    <Cell>{shortDate(b.dueDate)}</Cell>
                    <Cell className="font-mono">{money(purchaseTotal(b.lines))}</Cell>
                    <Cell className="font-mono">{money(billBalance(b))}</Cell>
                    <Cell><Badge tone={statusTone(b.status)}>{b.status}</Badge></Cell>
                    <Cell>
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {b.status === "Draft" && <button className="btn-primary px-2 py-1 text-xs" onClick={() => submitBill(b.id)}><Send size={11} /> Submit</button>}
                        {(b.status === "Awaiting Payment" || b.status === "Partially Paid" || b.status === "Overdue") && can("post") && <button className="btn-primary px-2 py-1 text-xs" onClick={() => { setPay(b); setPayF({ ...payF, amount: billBalance(b) }); }}><Banknote size={11} /> Pay</button>}
                      </div>
                    </Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          );
        }}
      </Tabs>

      {/* create */}
      <Modal open={create} onClose={() => setCreate(false)} title="New Bill" wide
        footer={<><Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button><Button variant="soft" onClick={() => submitCreate(false)}>Save draft</Button><Button onClick={() => submitCreate(true)}>Save & submit</Button></>}>
        <div className="space-y-4">
          {err && <p className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700 ring-1 ring-action-200">{err}</p>}
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Vendor"><Select value={f.vendorId} onChange={(e) => setF({ ...f, vendorId: e.target.value })} options={vendors.map((v) => ({ value: v.id, label: v.name }))} /></Field>
            <Field label="Vendor invoice #"><Input value={f.vendorInvoiceNumber} onChange={(e) => setF({ ...f, vendorInvoiceNumber: e.target.value })} /></Field>
            <Field label="Bill date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Due date"><Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
          </div>
          <LineEditor lines={f.lines} onChange={(lines) => setF({ ...f, lines })} accountFilter={purchaseAcct} accountLabel="Expense / item" />
          <DocTotals subtotal={purchaseSubtotal(f.lines as never)} tax={purchaseTax(f.lines as never)} total={purchaseTotal(f.lines as never)} />
          <Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
          <p className="text-xs text-mist-400">Approval rules may route this bill for sign-off before it posts to the ledger.</p>
        </div>
      </Modal>

      {/* view */}
      <Modal open={!!view} onClose={() => setView(null)} title={view?.number ?? ""} wide
        footer={view && <>
          <Button variant="ghost" onClick={() => setView(null)}>Close</Button>
          {view.status === "Draft" && <Button onClick={() => { submitBill(view.id); setView(null); }}><Send size={14} /> Submit</Button>}
          {view.status === "Pending Approval" && canDecide(view.approval) && <>
            <Button variant="ghost" onClick={() => { decideBill(view.id, "Rejected"); setView(null); }}><X size={14} /> Reject</Button>
            <Button onClick={() => { decideBill(view.id, "Approved"); setView(null); }}><Check size={14} /> Approve</Button>
          </>}
          {(view.status === "Awaiting Payment" || view.status === "Partially Paid" || view.status === "Overdue") && <Button onClick={() => { setPay(view); setPayF({ ...payF, amount: billBalance(view) }); }}><Banknote size={14} /> Pay</Button>}
          {view.status !== "Void" && view.amountPaid === 0 && view.journalEntryId && <Button variant="action" onClick={() => { const r = voidBill(view.id); if (r.ok) setView(null); else alert(r.error); }}><Ban size={14} /> Void</Button>}
        </>}>
        {view && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl bg-mist-50 p-3 text-sm sm:grid-cols-2">
              <div><span className="text-mist-400">Vendor</span> · {vendorById(view.vendorId)?.name}</div>
              <div><span className="text-mist-400">Status</span> · <Badge tone={statusTone(view.status)}>{view.status}</Badge></div>
              <div><span className="text-mist-400">Bill date</span> · {shortDate(view.date)}</div>
              <div><span className="text-mist-400">Due</span> · {shortDate(view.dueDate)}</div>
              {view.journalEntryId && <div><span className="text-mist-400">Journal</span> · posted</div>}
              <div><span className="text-mist-400">Paid</span> · {money(view.amountPaid)}</div>
            </div>
            {view.approval.status !== "Not Required" && (
              <div className="rounded-xl border border-mist-200 p-3 text-sm">
                <p className="mb-1 font-semibold">Approval — {view.approval.status}</p>
                {view.approval.steps.map((st) => (
                  <div key={st.level} className="flex justify-between py-0.5 text-xs">
                    <span>Level {st.level} · {st.approverRole}</span>
                    <span><Badge tone={st.decision === "Approved" ? "brand" : st.decision === "Rejected" ? "action" : "amber"}>{st.decision}</Badge></span>
                  </div>
                ))}
              </div>
            )}
            <Table columns={["Account", "Description", "Qty", "Unit", "Amount"]}>
              {view.lines.map((l, i) => (
                <Row key={l.id} index={i}>
                  <Cell className="text-xs">{l.accountNumber}</Cell>
                  <Cell>{l.description}</Cell>
                  <Cell>{l.qty}</Cell>
                  <Cell className="font-mono">{money(l.unitPrice)}</Cell>
                  <Cell className="font-mono">{money(l.qty * l.unitPrice)}</Cell>
                </Row>
              ))}
            </Table>
            <DocTotals subtotal={purchaseSubtotal(view.lines)} tax={purchaseTax(view.lines)} total={purchaseTotal(view.lines)} />
          </div>
        )}
      </Modal>

      {/* pay */}
      <Modal open={!!pay} onClose={() => setPay(null)} title={pay ? `Pay ${pay.number}` : ""}
        footer={<><Button variant="ghost" onClick={() => setPay(null)}>Cancel</Button><Button onClick={submitPay}>Post payment</Button></>}>
        {pay && (
          <div className="space-y-3">
            {err && <p className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700 ring-1 ring-action-200">{err}</p>}
            <p className="text-sm text-mist-600">Balance owing: <b>{money(billBalance(pay))}</b></p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date"><Input type="date" value={payF.date} onChange={(e) => setPayF({ ...payF, date: e.target.value })} /></Field>
              <Field label="Amount paid"><Input type="number" value={payF.amount || ""} onChange={(e) => setPayF({ ...payF, amount: +e.target.value })} /></Field>
              <Field label="WHT withheld"><Input type="number" value={payF.wht || ""} onChange={(e) => setPayF({ ...payF, wht: +e.target.value })} /></Field>
              <Field label="Method"><Select value={payF.method} onChange={(e) => setPayF({ ...payF, method: e.target.value as never })} options={["Bank Transfer", "Cheque", "Cash"]} /></Field>
              <Field label="Pay from"><Select value={String(payF.account)} onChange={(e) => setPayF({ ...payF, account: +e.target.value })} options={cashAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
              <Field label="Reference"><Input value={payF.reference} onChange={(e) => setPayF({ ...payF, reference: e.target.value })} /></Field>
            </div>
            <p className="text-xs text-mist-400">Posts Dr Accounts Payable {money(payF.amount + (payF.wht || 0))} / Cr bank {money(payF.amount)}{payF.wht ? ` / Cr WHT Payable ${money(payF.wht)}` : ""}.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
