import { useMemo, useState } from "react";
import { Plus, Trash2, Send, Check, X, Banknote, Wallet } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, statusTone, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useExpenses, claimSubtotal, claimTax, claimTotal } from "@/store/accounting/useExpenses";
import { useAcctControl } from "@/store/accounting/useAcctControl";
import { useLedger } from "@/store/accounting/useLedger";
import { useIdentity } from "@/store/useIdentity";
import { useHr } from "@/store/useHr";
import type { ExpenseClaim, ExpenseLine, ExpensePayMode } from "@/data/accounting/expenses";

const MODES: ExpensePayMode[] = ["Petty Cash", "Bank — direct", "Reimburse to staff"];
const newLine = (): Omit<ExpenseLine, "id"> => ({ accountNumber: 5300, description: "", amount: 0, taxRateId: undefined });

export default function Expenses() {
  const { claims, createClaim, submitClaim, decideClaim, payClaim, deleteDraft } = useExpenses();
  const { canDecide } = useAcctControl();
  useIdentity((s) => s.user.id);
  const staff = useHr((s) => s.staff);
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
  const expenseAccts = useLedger((s) => s.accounts).filter((a) => (a.type === "expense" || a.type === "cogs") && a.isActive);
  const cashAccts = useLedger((s) => s.accounts).filter((a) => a.subtype === "cash" || a.subtype === "bank");

  const [create, setCreate] = useState(false);
  const [view, setView] = useState<ExpenseClaim | null>(null);
  const [pay, setPay] = useState<ExpenseClaim | null>(null);
  const [payAcct, setPayAcct] = useState(1000);
  const [f, setF] = useState<{ date: string; title: string; costCenter: string; payMode: ExpensePayMode; paidFromAccount: number; receiptRef: string; lines: Omit<ExpenseLine, "id">[] }>({
    date: isoDate(new Date()), title: "", costCenter: "", payMode: "Petty Cash", paidFromAccount: 1010, receiptRef: "", lines: [newLine()],
  });

  function submit(send: boolean) {
    const id = createClaim({
      date: new Date(f.date + "T12:00:00Z").toISOString(),
      title: f.title.trim() || "Expense claim",
      costCenter: f.costCenter || undefined,
      payMode: f.payMode,
      paidFromAccount: f.payMode === "Bank — direct" ? f.paidFromAccount : undefined,
      receiptRef: f.receiptRef || undefined,
      lines: f.lines.filter((l) => l.amount > 0).map((l) => ({ ...l, id: `el-${Math.random().toString(36).slice(2, 7)}` })),
    });
    if (send) submitClaim(id);
    setCreate(false);
    setF({ ...f, title: "", lines: [newLine()] });
  }

  const myApprovals = claims.filter((c) => c.status === "Pending Approval" && canDecide(c.approval));
  const stats = useMemo(() => ({
    pending: claims.filter((c) => c.status === "Pending Approval").length,
    reimbursable: claims.filter((c) => c.status === "Approved" && c.payMode === "Reimburse to staff").reduce((n, c) => n + claimTotal(c.lines), 0),
    thisMonth: claims.filter((c) => c.status !== "Draft" && c.status !== "Rejected" && new Date(c.date).getUTCMonth() === new Date().getUTCMonth()).reduce((n, c) => n + claimTotal(c.lines), 0),
  }), [claims]);

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Petty-cash and staff-reimbursed spending — approval routed by amount, then posted to the ledger"
        actions={<Button onClick={() => setCreate(true)}><Plus size={15} /> New Claim</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Claims" value={claims.length} tone="brand" icon={<Wallet size={18} />} />
        <StatCard label="Pending approval" value={stats.pending} tone="amber" delay={0.05} />
        <StatCard label="Owed to staff" value={money(stats.reimbursable)} tone="action" delay={0.1} />
        <StatCard label="Expensed this month" value={money(stats.thisMonth)} tone="mist" delay={0.15} />
      </div>

      {myApprovals.length > 0 && (
        <Card className="mb-4 border-l-4 border-l-amber-400">
          <h3 className="mb-2 text-sm font-bold text-amber-700">Awaiting your approval ({myApprovals.length})</h3>
          {myApprovals.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-mist-50 px-3 py-2 text-sm">
              <span>{c.number} · {nameOf(c.claimantId)} · <b>{money(claimTotal(c.lines))}</b> · {c.title}</span>
              <span className="flex gap-1">
                <button className="btn-primary px-2 py-1 text-xs" onClick={() => decideClaim(c.id, "Approved")}><Check size={11} /> Approve</button>
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => decideClaim(c.id, "Rejected")}><X size={11} /> Reject</button>
              </span>
            </div>
          ))}
        </Card>
      )}

      <Tabs tabs={["All", "Draft", "Pending Approval", "Approved", "Paid"]}>
        {(t) => {
          const list = claims.filter((c) => (t === "All" ? true : c.status === t));
          if (!list.length) return <EmptyState title="No claims here" />;
          return (
            <Card className="p-0">
              <Table columns={["Claim", "Claimant", "Date", "Title", "Mode", "Total", "Status", ""]}>
                {list.map((c, i) => (
                  <Row key={c.id} index={i} onClick={() => setView(c)}>
                    <Cell className="font-mono text-xs">{c.number}</Cell>
                    <Cell className="font-semibold">{nameOf(c.claimantId)}</Cell>
                    <Cell>{shortDate(c.date)}</Cell>
                    <Cell className="max-w-[220px] truncate">{c.title}</Cell>
                    <Cell><Badge tone="mist">{c.payMode}</Badge></Cell>
                    <Cell className="font-mono">{money(claimTotal(c.lines))}</Cell>
                    <Cell><Badge tone={statusTone(c.status === "Paid" || c.status === "Approved" ? "approved" : c.status === "Rejected" ? "rejected" : c.status === "Draft" ? "draft" : "submitted")}>{c.status}</Badge></Cell>
                    <Cell>
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {c.status === "Draft" && <>
                          <button className="btn-primary px-2 py-1 text-xs" onClick={() => submitClaim(c.id)}><Send size={11} /></button>
                          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => deleteDraft(c.id)}><Trash2 size={11} /></button>
                        </>}
                        {c.status === "Approved" && c.payMode === "Reimburse to staff" && <button className="btn-primary px-2 py-1 text-xs" onClick={() => { setPayAcct(1000); setPay(c); }}><Banknote size={11} /> Reimburse</button>}
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
      <Modal open={create} onClose={() => setCreate(false)} title="New Expense Claim" wide
        footer={<><Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button><Button variant="soft" onClick={() => submit(false)}>Save draft</Button><Button onClick={() => submit(true)}>Save & submit</Button></>}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label="Cost centre"><Input value={f.costCenter} onChange={(e) => setF({ ...f, costCenter: e.target.value })} placeholder="e.g. Laboratory" /></Field>
            <Field label="Pay mode"><Select value={f.payMode} onChange={(e) => setF({ ...f, payMode: e.target.value as ExpensePayMode })} options={MODES} /></Field>
          </div>
          {f.payMode === "Bank — direct" && (
            <Field label="Pay from"><Select value={String(f.paidFromAccount)} onChange={(e) => setF({ ...f, paidFromAccount: +e.target.value })} options={cashAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
          )}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label mb-0">Lines</span>
              <button className="btn-soft px-2 py-1 text-xs" onClick={() => setF({ ...f, lines: [...f.lines, newLine()] })}><Plus size={12} /> Add line</button>
            </div>
            <div className="space-y-2">
              {f.lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1.3fr_1.4fr_120px_24px] items-center gap-2">
                  <Select value={String(l.accountNumber)} onChange={(e) => setF({ ...f, lines: f.lines.map((x, j) => (j === i ? { ...x, accountNumber: +e.target.value } : x)) })} options={expenseAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} />
                  <Input placeholder="Description" value={l.description} onChange={(e) => setF({ ...f, lines: f.lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
                  <Input type="number" placeholder="Amount" value={l.amount || ""} onChange={(e) => setF({ ...f, lines: f.lines.map((x, j) => (j === i ? { ...x, amount: +e.target.value } : x)) })} />
                  <button className="text-action-500" onClick={() => setF({ ...f, lines: f.lines.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 text-right text-sm font-bold">Total {money(claimTotal(f.lines as ExpenseLine[]))}</div>
          </div>
          <Field label="Receipt reference"><Input value={f.receiptRef} onChange={(e) => setF({ ...f, receiptRef: e.target.value })} /></Field>
        </div>
      </Modal>

      {/* view */}
      <Modal open={!!view} onClose={() => setView(null)} title={view?.number ?? ""} wide
        footer={view && <>
          <Button variant="ghost" onClick={() => setView(null)}>Close</Button>
          {view.status === "Draft" && <Button onClick={() => { submitClaim(view.id); setView(null); }}><Send size={14} /> Submit</Button>}
          {view.status === "Pending Approval" && canDecide(view.approval) && <>
            <Button variant="ghost" onClick={() => { decideClaim(view.id, "Rejected"); setView(null); }}><X size={14} /> Reject</Button>
            <Button onClick={() => { decideClaim(view.id, "Approved"); setView(null); }}><Check size={14} /> Approve</Button>
          </>}
          {view.status === "Approved" && view.payMode === "Reimburse to staff" && <Button onClick={() => { setPayAcct(1000); setPay(view); }}><Banknote size={14} /> Reimburse</Button>}
        </>}>
        {view && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl bg-mist-50 p-3 text-sm sm:grid-cols-2">
              <div><span className="text-mist-400">Claimant</span> · {nameOf(view.claimantId)}</div>
              <div><span className="text-mist-400">Status</span> · <Badge tone={statusTone(view.status === "Paid" ? "paid" : view.status)}>{view.status}</Badge></div>
              <div><span className="text-mist-400">Date</span> · {shortDate(view.date)}</div>
              <div><span className="text-mist-400">Mode</span> · {view.payMode}</div>
              {view.journalEntryId && <div><span className="text-mist-400">Accrual</span> · posted</div>}
              {view.paymentJournalEntryId && <div><span className="text-mist-400">Reimbursed</span> · posted</div>}
            </div>
            {view.approval.status !== "Not Required" && (
              <div className="rounded-xl border border-mist-200 p-3 text-sm">
                <p className="mb-1 font-semibold">Approval — {view.approval.status}</p>
                {view.approval.steps.map((st) => (
                  <div key={st.level} className="flex justify-between py-0.5 text-xs">
                    <span>Level {st.level} · {st.approverRole}</span>
                    <Badge tone={st.decision === "Approved" ? "brand" : st.decision === "Rejected" ? "action" : "amber"}>{st.decision}</Badge>
                  </div>
                ))}
              </div>
            )}
            <Table columns={["Account", "Description", "Amount"]}>
              {view.lines.map((l) => (
                <Row key={l.id}>
                  <Cell className="text-xs">{l.accountNumber}</Cell>
                  <Cell>{l.description}</Cell>
                  <Cell className="font-mono">{money(l.amount)}</Cell>
                </Row>
              ))}
            </Table>
            <div className="flex justify-end gap-6 text-sm">
              <span className="text-mist-500">Subtotal {money(claimSubtotal(view.lines))}</span>
              <span className="text-mist-500">Tax {money(claimTax(view.lines))}</span>
              <span className="font-bold">Total {money(claimTotal(view.lines))}</span>
            </div>
          </div>
        )}
      </Modal>

      {/* reimburse */}
      <Modal open={!!pay} onClose={() => setPay(null)} title={pay ? `Reimburse ${pay.number}` : ""}
        footer={<><Button variant="ghost" onClick={() => setPay(null)}>Cancel</Button><Button onClick={() => { if (pay) { const r = payClaim(pay.id, payAcct); if (r.ok) setPay(null); else alert(r.error); } }}>Pay {pay ? money(claimTotal(pay.lines)) : ""}</Button></>}>
        {pay && (
          <div className="space-y-3">
            <p className="text-sm text-mist-600">Reimburse <b>{nameOf(pay.claimantId)}</b> {money(claimTotal(pay.lines))}.</p>
            <Field label="Pay from"><Select value={String(payAcct)} onChange={(e) => setPayAcct(+e.target.value)} options={cashAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
            <p className="text-xs text-mist-400">Posts Dr Staff Reimbursements Payable / Cr {payAcct}.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
