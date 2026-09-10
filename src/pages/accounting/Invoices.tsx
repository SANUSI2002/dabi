import { useMemo, useState } from "react";
import { Plus, Printer, Send, Ban, Banknote, FileText } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, statusTone, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PrintDoc, Section, Line } from "@/components/print/PrintFrame";
import { money, shortDate, dateTime, isoDate } from "@/lib/format";
import { useAR, docSubtotal, docTax, docTotal } from "@/store/accounting/useAR";
import { useProjects } from "@/store/accounting/useProjects";
import { useLedger } from "@/store/accounting/useLedger";
import { LineEditor, DocTotals, type EditableLine } from "./_components";
import type { Invoice } from "@/data/accounting/receivables";

export default function Invoices() {
  const { customers, invoices, customerById, createInvoice, issueInvoice, voidInvoice, recordReceipt, invoiceBalance, reminderDue, sendReminder, runReminderRun, reminders, unbilledChargesOf, earlyPayDiscountFor } = useAR();
  const [takeDiscount, setTakeDiscount] = useState(true);
  const projects = useProjects((s) => s.projects);
  const [pullCharges, setPullCharges] = useState(true);
  const accounts = useLedger((s) => s.accounts);
  const cashAccts = accounts.filter((a) => a.subtype === "cash" || a.subtype === "bank");

  const [create, setCreate] = useState(false);
  const [view, setView] = useState<Invoice | null>(null);
  const [pay, setPay] = useState<Invoice | null>(null);
  const [print, setPrint] = useState<Invoice | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [creditBlock, setCreditBlock] = useState<string | null>(null);

  const fxRates = useLedger((s) => s.fxRates);
  const [f, setF] = useState<{ customerId: string; date: string; dueDate: string; notes: string; currency: string; exchangeRate: number; deferMonths: number; recurMonths: number; projectId: string; lines: EditableLine[] }>({
    customerId: customers[0]?.id ?? "",
    date: isoDate(new Date()),
    dueDate: isoDate(new Date(Date.now() + 30 * 864e5)),
    notes: "",
    currency: "NGN",
    exchangeRate: 1,
    deferMonths: 0,
    recurMonths: 0,
    projectId: "",
    lines: [{ accountNumber: 4000, description: "", qty: 1, unitPrice: 0, taxRateId: "tax-vat-exempt" }],
  });

  const [payF, setPayF] = useState({ date: isoDate(new Date()), method: "Bank Transfer" as const, account: 1010, amount: 0, reference: "", settlementRate: 0 });

  function submitCreate(issue: boolean, overrideCredit = false) {
    setErr(null);
    if (!f.customerId) return setErr("Pick a customer.");
    if (!draftId) {
      const id = createInvoice({
        customerId: f.customerId,
        date: new Date(f.date + "T12:00:00Z").toISOString(),
        dueDate: new Date(f.dueDate + "T12:00:00Z").toISOString(),
        lines: f.lines.map((l) => ({ ...l, id: `sl-${Math.random().toString(36).slice(2, 7)}` })),
        notes: f.notes || undefined,
        currency: f.currency,
        exchangeRate: f.currency === "NGN" ? 1 : f.exchangeRate,
        deferOverMonths: f.deferMonths || undefined,
        recurEveryMonths: f.recurMonths || undefined,
        projectId: f.projectId || undefined,
        delayedChargeIds: pullCharges ? unbilledChargesOf(f.customerId).map((d) => d.id) : undefined,
      });
      setDraftId(id);
      if (issue) {
        const r = issueInvoice(id, { overrideCredit });
        if (!r.ok) { setCreditBlock(r.error ?? "Could not issue"); return; }
      }
    } else if (issue) {
      const r = issueInvoice(draftId, { overrideCredit });
      if (!r.ok) { setCreditBlock(r.error ?? "Could not issue"); return; }
    }
    setDraftId(null); setCreditBlock(null);
    setCreate(false);
  }

  function submitPay() {
    if (!pay) return;
    setErr(null);
    const foreign = pay.currency !== "NGN";
    const setRate = foreign ? payF.settlementRate || pay.exchangeRate : 1;
    const discount = !foreign && takeDiscount ? earlyPayDiscountFor(pay, new Date(payF.date + "T12:00:00Z").toISOString()) : 0;
    // allocation is in the invoice's currency; for a foreign invoice payF.amount is the NGN deposited
    const allocForeign = foreign ? Math.min(payF.amount / setRate, invoiceBalance(pay)) : Math.min(payF.amount, invoiceBalance(pay) - discount);
    const r = recordReceipt({
      customerId: pay.customerId,
      date: new Date(payF.date + "T12:00:00Z").toISOString(),
      method: payF.method,
      depositAccountNumber: payF.account,
      amount: payF.amount,
      allocations: [{ invoiceId: pay.id, amount: allocForeign, discount: discount || undefined }],
      settlementRate: foreign ? setRate : undefined,
      reference: payF.reference || undefined,
    });
    if (!r.ok) return setErr(r.error ?? "Could not record payment");
    setPay(null);
  }

  const stats = useMemo(() => {
    const live = invoices.filter((i) => i.status !== "Draft" && i.status !== "Void");
    return {
      outstanding: live.reduce((n, i) => n + invoiceBalance(i), 0),
      overdue: live.filter((i) => i.status === "Overdue").reduce((n, i) => n + invoiceBalance(i), 0),
      draft: invoices.filter((i) => i.status === "Draft").length,
      thisMonth: live.filter((i) => new Date(i.date).getUTCMonth() === new Date().getUTCMonth()).reduce((n, i) => n + docTotal(i.lines), 0),
    };
  }, [invoices, invoiceBalance]);

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Bill customers — issuing posts Dr Accounts Receivable / Cr revenue (+ VAT) to the ledger"
        actions={<Button onClick={() => { setErr(null); setCreate(true); }}><Plus size={15} /> New Invoice</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Outstanding" value={money(stats.outstanding)} tone="brand" icon={<FileText size={18} />} />
        <StatCard label="Overdue" value={money(stats.overdue)} tone="action" delay={0.05} />
        <StatCard label="Drafts" value={stats.draft} tone="amber" delay={0.1} />
        <StatCard label="Reminders sent" value={reminders.length} tone="mist" delay={0.15} />
      </div>

      {(() => {
        const dueList = invoices.map((i) => ({ inv: i, due: reminderDue(i) })).filter((x) => x.due);
        if (!dueList.length) return null;
        return (
          <Card className="mb-4 border-l-4 border-l-amber-400">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-amber-700">Payment reminders due ({dueList.length})</h3>
              <Button variant="soft" onClick={() => { const r = runReminderRun(); alert(`Sent ${r.sent} reminder(s).`); }}>Send all</Button>
            </div>
            <div className="space-y-1.5">
              {dueList.slice(0, 6).map(({ inv, due }) => (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-mist-50 px-3 py-1.5 text-sm">
                  <span>{inv.number} · {customerById(inv.customerId)?.name} · <b>{money(invoiceBalance(inv))}</b> · <Badge tone={due!.level === 3 ? "action" : "amber"}>{due!.tone}</Badge></span>
                  <button className="btn-primary px-2 py-1 text-xs" onClick={() => sendReminder(inv.id)}><Send size={11} /> Send</button>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      <Tabs tabs={["All", "Open", "Overdue", "Draft", "Paid"]}>
        {(t) => {
          const list = invoices.filter((i) =>
            t === "All" ? true : t === "Open" ? i.status === "Open" || i.status === "Partially Paid" : t === "Overdue" ? i.status === "Overdue" : t === "Draft" ? i.status === "Draft" : i.status === "Paid",
          );
          if (!list.length) return <EmptyState title="No invoices here" />;
          return (
            <Card className="p-0">
              <Table columns={["Invoice", "Customer", "Date", "Due", "Total", "Balance", "Status", ""]}>
                {list.map((inv, i) => (
                  <Row key={inv.id} index={i} onClick={() => setView(inv)}>
                    <Cell className="font-mono text-xs">{inv.number}{inv.source === "EMR Billing" && <Badge tone="mist">EMR</Badge>}</Cell>
                    <Cell className="font-semibold">{customerById(inv.customerId)?.name}{inv.currency !== "NGN" && <Badge tone="amber">{inv.currency}</Badge>}{inv.revenueScheduleId && <Badge tone="mist">deferred</Badge>}{inv.isRecurring && <Badge tone="mist">recurring</Badge>}</Cell>
                    <Cell>{shortDate(inv.date)}</Cell>
                    <Cell>{shortDate(inv.dueDate)}</Cell>
                    <Cell className="font-mono">{inv.currency !== "NGN" ? `${inv.currency} ${docTotal(inv.lines).toLocaleString()}` : money(docTotal(inv.lines))}</Cell>
                    <Cell className="font-mono">{inv.currency !== "NGN" ? `${inv.currency} ${invoiceBalance(inv).toLocaleString()}` : money(invoiceBalance(inv))}</Cell>
                    <Cell><Badge tone={statusTone(inv.status)}>{inv.status}</Badge></Cell>
                    <Cell>
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {inv.status === "Draft" && <button className="btn-primary px-2 py-1 text-xs" onClick={() => { const r = issueInvoice(inv.id); if (!r.ok) alert(r.error); }}><Send size={11} /> Issue</button>}
                        {(inv.status === "Open" || inv.status === "Partially Paid" || inv.status === "Overdue") && <button className="btn-primary px-2 py-1 text-xs" onClick={() => { setPay(inv); setPayF({ ...payF, amount: invoiceBalance(inv) }); }}><Banknote size={11} /> Pay</button>}
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setPrint(inv)}><Printer size={11} /></button>
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
      <Modal open={create} onClose={() => { setCreate(false); setDraftId(null); setCreditBlock(null); }} title={draftId ? "Invoice saved as draft" : "New Invoice"} wide
        footer={creditBlock
          ? <><Button variant="ghost" onClick={() => { setCreate(false); setDraftId(null); setCreditBlock(null); }}>Leave as draft</Button><Button variant="action" onClick={() => submitCreate(true, true)}>Issue anyway (override)</Button></>
          : <><Button variant="ghost" onClick={() => { setCreate(false); setDraftId(null); }}>Cancel</Button><Button variant="soft" onClick={() => submitCreate(false)}>Save draft</Button><Button onClick={() => submitCreate(true)}>Save & issue</Button></>}>
        <div className="space-y-4">
          {err && <p className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700 ring-1 ring-action-200">{err}</p>}
          {creditBlock && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">Credit check: {creditBlock}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Customer"><Select value={f.customerId} onChange={(e) => { const c = customers.find((x) => x.id === e.target.value); setF({ ...f, customerId: e.target.value, currency: c?.currency ?? "NGN", exchangeRate: c?.currency && c.currency !== "NGN" ? (fxRates.find((r) => r.code === c.currency)?.rateToNgn ?? 1) : 1 }); }} options={customers.map((c) => ({ value: c.id, label: c.name }))} /></Field>
            <Field label="Invoice date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Due date"><Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Currency"><Select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value, exchangeRate: e.target.value === "NGN" ? 1 : (fxRates.find((r) => r.code === e.target.value)?.rateToNgn ?? 1) })} options={fxRates.map((r) => ({ value: r.code, label: r.code }))} /></Field>
            {f.currency !== "NGN" && <Field label="Rate → NGN"><Input type="number" value={f.exchangeRate} onChange={(e) => setF({ ...f, exchangeRate: +e.target.value })} /></Field>}
            <Field label="Recognise over (mo)" hint="0 = now"><Input type="number" value={f.deferMonths || ""} onChange={(e) => setF({ ...f, deferMonths: +e.target.value })} /></Field>
            <Field label="Repeat every (mo)" hint="0 = one-off"><Input type="number" value={f.recurMonths || ""} onChange={(e) => setF({ ...f, recurMonths: +e.target.value })} /></Field>
          </div>
          {projects.length > 0 && <Field label="Project (optional)"><Select value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} options={[{ value: "", label: "— none —" }, ...projects.filter((p) => p.status === "Active").map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))]} /></Field>}
          {f.customerId && unbilledChargesOf(f.customerId).length > 0 && (
            <label className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
              <input type="checkbox" checked={pullCharges} onChange={(e) => setPullCharges(e.target.checked)} />
              Add {unbilledChargesOf(f.customerId).length} unbilled delayed charge(s) — {money(unbilledChargesOf(f.customerId).reduce((n, d) => n + d.qty * d.unitPrice, 0))}
            </label>
          )}
          <LineEditor lines={f.lines} onChange={(lines) => setF({ ...f, lines })} />
          <DocTotals subtotal={docSubtotal(f.lines as never)} tax={docTax(f.lines as never)} total={docTotal(f.lines as never)} />
          {f.currency !== "NGN" && <p className="text-right text-xs text-mist-400">≈ {money(docTotal(f.lines as never) * f.exchangeRate)} at {f.exchangeRate}/{f.currency}</p>}
          <Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
      </Modal>

      {/* view */}
      <Modal open={!!view} onClose={() => setView(null)} title={view?.number ?? ""} wide
        footer={view && <>
          <Button variant="ghost" onClick={() => setView(null)}>Close</Button>
          {view.status === "Draft" && <Button onClick={() => { const r = issueInvoice(view.id); if (r.ok) setView(null); else alert(r.error); }}><Send size={14} /> Issue</Button>}
          {(view.status === "Open" || view.status === "Partially Paid" || view.status === "Overdue") && <Button onClick={() => { setPay(view); setPayF({ ...payF, amount: invoiceBalance(view) }); }}><Banknote size={14} /> Record payment</Button>}
          {view.status !== "Void" && view.amountPaid === 0 && <Button variant="action" onClick={() => { const r = voidInvoice(view.id); if (r.ok) setView(null); else alert(r.error); }}><Ban size={14} /> Void</Button>}
        </>}>
        {view && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl bg-mist-50 p-3 text-sm sm:grid-cols-2">
              <div><span className="text-mist-400">Customer</span> · {customerById(view.customerId)?.name}</div>
              <div><span className="text-mist-400">Status</span> · <Badge tone={statusTone(view.status)}>{view.status}</Badge></div>
              <div><span className="text-mist-400">Date</span> · {shortDate(view.date)}</div>
              <div><span className="text-mist-400">Due</span> · {shortDate(view.dueDate)}</div>
              {view.journalEntryId && <div><span className="text-mist-400">Journal</span> · posted</div>}
              {view.issuedAt && <div><span className="text-mist-400">Issued</span> · {dateTime(view.issuedAt)}</div>}
            </div>
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
            <DocTotals subtotal={docSubtotal(view.lines)} tax={docTax(view.lines)} total={docTotal(view.lines)} />
            <div className="flex justify-end gap-6 text-sm"><span className="text-mist-500">Paid {money(view.amountPaid)}</span><span className="font-bold">Balance {money(invoiceBalance(view))}</span></div>
          </div>
        )}
      </Modal>

      {/* pay */}
      <Modal open={!!pay} onClose={() => setPay(null)} title={pay ? `Payment — ${pay.number}` : ""}
        footer={<><Button variant="ghost" onClick={() => setPay(null)}>Cancel</Button><Button onClick={submitPay}>Post receipt</Button></>}>
        {pay && (
          <div className="space-y-3">
            {err && <p className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700 ring-1 ring-action-200">{err}</p>}
            <p className="text-sm text-mist-600">Balance due: <b>{pay.currency !== "NGN" ? `${pay.currency} ${invoiceBalance(pay).toLocaleString()}` : money(invoiceBalance(pay))}</b>{pay.currency !== "NGN" && ` (booked @ ${pay.exchangeRate})`}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date"><Input type="date" value={payF.date} onChange={(e) => setPayF({ ...payF, date: e.target.value })} /></Field>
              <Field label={pay.currency !== "NGN" ? "NGN received to bank" : "Amount"}><Input type="number" value={payF.amount || ""} onChange={(e) => setPayF({ ...payF, amount: +e.target.value })} /></Field>
              {pay.currency !== "NGN" && <Field label={`Settlement rate (${pay.currency}→NGN)`} hint="rate on the day the money arrived"><Input type="number" value={payF.settlementRate || pay.exchangeRate} onChange={(e) => setPayF({ ...payF, settlementRate: +e.target.value })} /></Field>}
              <Field label="Method"><Select value={payF.method} onChange={(e) => setPayF({ ...payF, method: e.target.value as never })} options={["Cash", "Bank Transfer", "POS", "Cheque", "NHIS Remittance"]} /></Field>
              <Field label="Deposit to"><Select value={String(payF.account)} onChange={(e) => setPayF({ ...payF, account: +e.target.value })} options={cashAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
            </div>
            <Field label="Reference"><Input value={payF.reference} onChange={(e) => setPayF({ ...payF, reference: e.target.value })} /></Field>
            {pay.currency === "NGN" && earlyPayDiscountFor(pay, new Date(payF.date + "T12:00:00Z").toISOString()) > 0 && (
              <label className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800 ring-1 ring-brand-200">
                <input type="checkbox" checked={takeDiscount} onChange={(e) => setTakeDiscount(e.target.checked)} />
                Apply early-payment discount — {money(earlyPayDiscountFor(pay, new Date(payF.date + "T12:00:00Z").toISOString()))} (posts to Discounts &amp; Waivers)
              </label>
            )}
            <p className="text-xs text-mist-400">{pay.currency !== "NGN" ? "AR relieved at the booked rate; the difference vs the settlement rate posts to FX gain / loss." : `Posts Dr ${payF.account} / Cr ${customerById(pay.customerId)?.arAccountNumber} Accounts Receivable.`}</p>
          </div>
        )}
      </Modal>

      {/* print */}
      {print && (() => {
        const c = customerById(print.customerId);
        return (
          <PrintDoc open onClose={() => setPrint(null)} docTitle={print.status === "Paid" ? "Tax Invoice (Paid)" : "Tax Invoice"}>
            <Section title="Bill To">
              <Line label="Customer" value={c?.name} />
              <Line label="Invoice no." value={print.number} />
              <Line label="Date" value={shortDate(print.date)} />
              <Line label="Due" value={shortDate(print.dueDate)} />
            </Section>
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-y border-mist-300 text-left text-[11px] uppercase text-mist-500"><th className="py-2">Description</th><th className="text-center">Qty</th><th className="text-right">Unit</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {print.lines.map((l, i) => (
                  <tr key={i} className="border-b border-mist-100"><td className="py-2">{l.description}</td><td className="text-center">{l.qty}</td><td className="text-right font-mono">{money(l.unitPrice)}</td><td className="text-right font-mono">{money(l.qty * l.unitPrice)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3"><DocTotals subtotal={docSubtotal(print.lines)} tax={docTax(print.lines)} total={docTotal(print.lines)} /></div>
            <p className="mt-4 text-sm">Amount paid: <b>{money(print.amountPaid)}</b> · Balance: <b>{money(docTotal(print.lines) - print.amountPaid)}</b></p>
          </PrintDoc>
        );
      })()}
    </div>
  );
}
