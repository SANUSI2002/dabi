import { useEffect, useMemo, useState } from "react";
import { Building2, FileCheck2, Send, Gavel, CalendarRange, Ban, ShieldAlert, Undo2, Plus, RotateCcw } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, statusTone, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useAR, docTotal } from "@/store/accounting/useAR";
import { useLedger } from "@/store/accounting/useLedger";
import { useIsLiveEmr } from "@/emr-live/session";
import {
  usePayers, loadPayers, billToPayer, reverseTransfer, createClaim, removeFromClaim, submitClaim, cancelClaim, adjudicateClaim,
  recordCapitation, recognizeCapitation, writeOff, recoverWriteOff, measureCreditLoss, type PayerClaim, type LossBucket, type LossRates, type WriteOff,
} from "@/accounting-live/payers";

// HMO & NHIA: patients' charges billed to their payer, claims submitted and adjudicated, capitation, and
// the credit risk on receivables (write-offs, recoveries and the expected-credit-loss allowance). Each
// action posts to the books on the server; this page shows what it did.

const OPEN = ["Open", "Partially Paid", "Overdue"];
const PAYER_TYPES = ["NHIS", "HMO"];
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function Payers() {
  const live = useIsLiveEmr();
  if (!live) return (
    <div>
      <PageHeader title="HMO & NHIA Claims" subtitle="Payer billing, claims, capitation and credit-loss allowance" />
      <Card><EmptyState title="Runs on a live hospital's books" hint="Billing HMOs and NHIA, claims adjudication, capitation and the expected-credit-loss allowance post real journal entries, so they work on a live hospital. This preview has no books to post to." /></Card>
    </div>
  );
  return <LivePayers />;
}

function LivePayers() {
  const p = usePayers();
  const { invoices, customers } = useAR();
  const cashAccts = useLedger((s) => s.accounts).filter((a) => a.subtype === "cash" || a.subtype === "bank");
  const [note, setNote] = useState("");
  useEffect(() => { void loadPayers(); }, []);
  const say = (r: { ok: boolean; error?: string }, done: string) => setNote(r.ok ? done : r.error ?? "Something went wrong.");

  const payerIds = new Set(customers.filter((c) => PAYER_TYPES.includes(c.type)).map((c) => c.id));
  const balance = (i: (typeof invoices)[number]) => round2(docTotal(i.lines) - i.amountPaid);
  const patientOpen = invoices.filter((i) => OPEN.includes(i.status) && !payerIds.has(i.customerId) && i.currency === "NGN");
  const payerOpen = invoices.filter((i) => OPEN.includes(i.status) && payerIds.has(i.customerId));
  const claimOpen = p.claims.filter((c) => c.status === "Submitted");

  return (
    <div>
      <PageHeader title="HMO & NHIA Claims" subtitle="Bill payers for covered patients, claim and adjudicate, record capitation, and provide for bad debts" />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Owed by payers" value={money(payerOpen.reduce((n, i) => n + balance(i) * i.exchangeRate, 0))} tone="brand" icon={<Building2 size={18} />} />
        <StatCard label="Claims awaiting decision" value={claimOpen.length} tone={claimOpen.length ? "amber" : "mist"} delay={0.05} />
        <StatCard label="Denied (adjudicated claims)" value={money(p.claims.reduce((n, c) => n + (c.denied ?? 0), 0))} tone="action" delay={0.1} />
        <StatCard label="Allowance for doubtful debts" value={money(p.allowance)} tone="mist" delay={0.15} />
      </div>
      {note && <p className="mb-4 rounded-lg bg-mist-50 px-3 py-2 text-sm text-mist-700 ring-1 ring-mist-200">{note}</p>}
      {p.error && <p className="mb-4 rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700 ring-1 ring-action-200">{p.error}</p>}
      <Tabs tabs={["Bill a payer", "Claims", "Capitation", "Write-offs", "Credit loss (ECL)"]}>
        {(t) => t === "Bill a payer" ? <BillPayer patientOpen={patientOpen} balance={balance} say={say} />
          : t === "Claims" ? <Claims say={say} />
          : t === "Capitation" ? <CapitationTab cashAccts={cashAccts} say={say} />
          : t === "Write-offs" ? <WriteOffs openInvoices={invoices.filter((i) => OPEN.includes(i.status))} balance={balance} cashAccts={cashAccts} say={say} />
          : <CreditLoss key={JSON.stringify(p.defaultLossRates)} say={say} />}
      </Tabs>
      <p className="mt-4 text-xs text-mist-400">Posts: billing a payer Dr payer receivable / Cr patient receivable · denials Dr 4910 Claim Denials or back to the patient · capitation Cr 4060 (2400 until the month begins) · write-offs Dr 1190 Allowance, then 5700 Bad Debt Expense · recoveries Cr 4120.</p>
    </div>
  );
}

type Say = (r: { ok: boolean; error?: string }, done: string) => void;

function BillPayer({ patientOpen, balance, say }: { patientOpen: ReturnType<typeof useAR.getState>["invoices"]; balance: (i: ReturnType<typeof useAR.getState>["invoices"][number]) => number; say: Say }) {
  const p = usePayers();
  const { customerById, invoices } = useAR();
  const [pick, setPick] = useState<string | null>(null);
  const inv = patientOpen.find((i) => i.id === pick);
  const [f, setF] = useState({ payerId: "", amount: 0, authorizationCode: "", enrolleeNumber: "" });
  const [busy, setBusy] = useState(false);
  const numberOf = (id: string) => invoices.find((i) => i.id === id)?.number ?? "—";
  return (
    <div className="space-y-4">
      <Card className="p-0">
        <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-600">Patients' open invoices</p>
        {patientOpen.length === 0 ? <EmptyState title="Nothing to bill" hint="Open patient invoices appear here (EMR bills included)." /> : (
          <Table columns={["Invoice", "Patient", "Date", "Balance", "Status", ""]}>
            {patientOpen.map((i, n) => (
              <Row key={i.id} index={n}>
                <Cell className="font-mono text-xs">{i.number}{i.source === "EMR Billing" && <Badge tone="mist">EMR</Badge>}</Cell>
                <Cell className="font-semibold">{customerById(i.customerId)?.name}</Cell>
                <Cell>{shortDate(i.date)}</Cell>
                <Cell className="font-mono">{money(balance(i))}</Cell>
                <Cell><Badge tone={statusTone(i.status)}>{i.status}</Badge></Cell>
                <Cell><button className="btn-primary px-2 py-1 text-xs" disabled={!p.payers.length} onClick={() => { setPick(i.id); setF({ payerId: p.payers[0]?.id ?? "", amount: balance(i), authorizationCode: "", enrolleeNumber: "" }); }}><Send size={11} /> Bill payer</button></Cell>
              </Row>
            ))}
          </Table>
        )}
        {!p.payers.length && <p className="px-4 py-2 text-xs text-amber-700">Add your HMOs and NHIA as customers (type HMO or NHIS) to bill them.</p>}
      </Card>
      <Card className="p-0">
        <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-600">Billed to payers</p>
        {p.transfers.length === 0 ? <EmptyState title="No payer billing yet" /> : (
          <Table columns={["Payer invoice", "Payer", "Patient", "Patient invoice", "Amount", "Auth / enrollee", "Status", ""]}>
            {p.transfers.map((t, n) => (
              <Row key={t.id} index={n}>
                <Cell className="font-mono text-xs">{numberOf(t.payerInvoiceId)}</Cell>
                <Cell className="font-semibold">{customerById(t.payerCustomerId)?.name}</Cell>
                <Cell>{customerById(t.patientCustomerId)?.name}</Cell>
                <Cell className="font-mono text-xs">{numberOf(t.patientInvoiceId)}</Cell>
                <Cell className="font-mono">{money(t.amount)}{t.rebilledAmount > 0 && <span className="block text-[11px] text-action-600">{money(t.rebilledAmount)} billed back</span>}</Cell>
                <Cell className="text-xs">{[t.authorizationCode, t.enrolleeNumber].filter(Boolean).join(" · ") || "—"}</Cell>
                <Cell>{t.reversedAt ? <Badge tone="mist">Reversed</Badge> : <Badge tone="brand">Billed</Badge>}</Cell>
                <Cell>{!t.reversedAt && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => void reverseTransfer(t.id).then((r) => say(r, "Transfer reversed: the patient owes the invoice again."))}><Undo2 size={11} /> Reverse</button>}</Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>
      <Modal open={!!inv} onClose={() => setPick(null)} title={inv ? `Bill ${inv.number} to a payer` : ""}
        footer={<><Button variant="ghost" onClick={() => setPick(null)}>Cancel</Button><Button disabled={busy || !f.payerId || f.amount <= 0} onClick={() => { if (!inv) return; setBusy(true); void billToPayer(inv.id, { payerId: f.payerId, amount: f.amount, authorizationCode: f.authorizationCode || undefined, enrolleeNumber: f.enrolleeNumber || undefined }).then((r) => { setBusy(false); setPick(null); say(r, r.ok ? `Billed: payer invoice ${r.data.payerInvoiceNumber}.` : ""); }); }}>Bill payer</Button></>}>
        {inv && (
          <div className="space-y-3">
            <p className="text-sm text-mist-600">{customerById(inv.customerId)?.name} owes <b>{money(balance(inv))}</b> on {inv.number}. Bill all or part of it to their payer; the patient keeps any balance (their co-payment).</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Payer"><Select value={f.payerId} onChange={(e) => setF({ ...f, payerId: e.target.value })} options={p.payers.map((x) => ({ value: x.id, label: `${x.name} (${x.type})` }))} /></Field>
              <Field label="Amount to bill"><Input type="number" value={f.amount || ""} onChange={(e) => setF({ ...f, amount: +e.target.value })} /></Field>
              <Field label="Authorization code"><Input value={f.authorizationCode} onChange={(e) => setF({ ...f, authorizationCode: e.target.value })} /></Field>
              <Field label="Enrollee number"><Input value={f.enrolleeNumber} onChange={(e) => setF({ ...f, enrolleeNumber: e.target.value })} /></Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Claims({ say }: { say: Say }) {
  const p = usePayers();
  const { customerById } = useAR();
  const [create, setCreate] = useState(false);
  const month = new Date();
  const [f, setF] = useState({ payerId: "", periodStart: isoDate(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))), periodEnd: isoDate(new Date()), notes: "" });
  const [view, setView] = useState<PayerClaim | null>(null);
  const [reference, setReference] = useState("");
  const [decisions, setDecisions] = useState<Record<string, { approved: number; reason: string; action: "write-off" | "rebill" }>>({});
  const current = view && p.claims.find((c) => c.id === view.id);
  const open = (c: PayerClaim) => { setView(c); setReference(c.reference ?? ""); setDecisions(Object.fromEntries(c.items.map((i) => [i.invoiceId, { approved: i.approved ?? i.claimed, reason: i.reason ?? "", action: i.action ?? "write-off" }]))); };
  const transferInvoices = new Set(p.transfers.filter((t) => !t.reversedAt).map((t) => t.payerInvoiceId));
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button disabled={!p.payers.length} onClick={() => { setF({ ...f, payerId: p.payers[0]?.id ?? "" }); setCreate(true); }}><Plus size={14} /> New claim</Button></div>
      <Card className="p-0">
        {p.claims.length === 0 ? <EmptyState title="No claims yet" hint="A claim gathers a payer's open invoices for a period." /> : (
          <Table columns={["Claim", "Payer", "Period", "Invoices", "Claimed", "Approved", "Denied", "Status"]}>
            {p.claims.map((c, n) => (
              <Row key={c.id} index={n} onClick={() => open(c)}>
                <Cell className="font-mono text-xs">{c.number}{c.reference && <span className="block text-[11px] text-mist-400">{c.reference}</span>}</Cell>
                <Cell className="font-semibold">{customerById(c.payerCustomerId)?.name}</Cell>
                <Cell className="text-xs">{shortDate(c.periodStart)} – {shortDate(c.periodEnd)}</Cell>
                <Cell>{c.items.length}</Cell>
                <Cell className="font-mono">{money(c.claimed)}</Cell>
                <Cell className="font-mono">{c.approved !== undefined ? money(c.approved) : "—"}</Cell>
                <Cell className="font-mono text-action-600">{c.denied !== undefined ? money(c.denied) : "—"}</Cell>
                <Cell><Badge tone={statusTone(c.status)}>{c.status}</Badge></Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>
      <Modal open={create} onClose={() => setCreate(false)} title="New claim"
        footer={<><Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button><Button disabled={!f.payerId} onClick={() => void createClaim({ payerId: f.payerId, periodStart: f.periodStart, periodEnd: f.periodEnd, notes: f.notes || undefined }).then((r) => { setCreate(false); say(r, r.ok ? `Claim ${r.data.number} drafted for ${money(r.data.claimed)}.` : ""); })}>Create claim</Button></>}>
        <div className="space-y-3">
          <p className="text-sm text-mist-600">The claim takes the payer's open invoices dated in the period that are not already on an open claim.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Payer"><Select value={f.payerId} onChange={(e) => setF({ ...f, payerId: e.target.value })} options={p.payers.map((x) => ({ value: x.id, label: x.name }))} /></Field>
            <Field label="From"><Input type="date" value={f.periodStart} onChange={(e) => setF({ ...f, periodStart: e.target.value })} /></Field>
            <Field label="To"><Input type="date" value={f.periodEnd} onChange={(e) => setF({ ...f, periodEnd: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
      </Modal>
      <Modal open={!!current} onClose={() => setView(null)} title={current ? `${current.number} — ${customerById(current.payerCustomerId)?.name}` : ""} wide
        footer={current && <>
          <Button variant="ghost" onClick={() => setView(null)}>Close</Button>
          {["Draft", "Submitted"].includes(current.status) && <Button variant="action" onClick={() => void cancelClaim(current.id).then((r) => { setView(null); say(r, `Claim ${current.number} cancelled.`); })}><Ban size={14} /> Cancel claim</Button>}
          {current.status === "Draft" && <Button onClick={() => void submitClaim(current.id, reference || undefined).then((r) => say(r, `Claim ${current.number} submitted.`))}><Send size={14} /> Submit</Button>}
          {current.status === "Submitted" && <Button onClick={() => void adjudicateClaim(current.id, current.items.map((i) => ({ invoiceId: i.invoiceId, approved: decisions[i.invoiceId]?.approved ?? i.claimed, reason: decisions[i.invoiceId]?.reason || undefined, action: decisions[i.invoiceId]?.action }))).then((r) => { if (r.ok) setView(null); say(r, r.ok ? `Adjudicated: ${money(r.data.approved)} approved, ${money(r.data.denied)} denied.` : ""); })}><Gavel size={14} /> Record decision</Button>}
        </>}>
        {current && (
          <div className="space-y-3">
            {current.status === "Draft" && <Field label="Payer's claim / batch reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>}
            {current.status === "Submitted" && <p className="text-sm text-mist-600">Enter what the payer approved on each invoice. A denial is written off to Claim Denials, or — for a patient's charges — billed back to the patient.</p>}
            <Table columns={current.status === "Submitted" ? ["Invoice", "Claimed", "Approved", "Denial", "Reason"] : ["Invoice", "Date", "Claimed", "Approved", "Denied", "Booked as", ""]}>
              {current.items.map((i, n) => {
                const d = decisions[i.invoiceId] ?? { approved: i.claimed, reason: "", action: "write-off" as const };
                return current.status === "Submitted" ? (
                  <Row key={i.invoiceId} index={n}>
                    <Cell className="font-mono text-xs">{i.number}</Cell>
                    <Cell className="font-mono">{money(i.claimed)}</Cell>
                    <Cell><Input type="number" value={d.approved} onChange={(e) => setDecisions({ ...decisions, [i.invoiceId]: { ...d, approved: +e.target.value } })} /></Cell>
                    <Cell>{i.claimed - d.approved > 0.005 ? <Select value={d.action} onChange={(e) => setDecisions({ ...decisions, [i.invoiceId]: { ...d, action: e.target.value as "write-off" | "rebill" } })} options={[{ value: "write-off", label: `Write off ${money(round2(i.claimed - d.approved))}` }, ...(transferInvoices.has(i.invoiceId) ? [{ value: "rebill", label: "Bill back to the patient" }] : [])]} /> : <span className="text-xs text-mist-400">none</span>}</Cell>
                    <Cell><Input value={d.reason} placeholder="e.g. not covered" onChange={(e) => setDecisions({ ...decisions, [i.invoiceId]: { ...d, reason: e.target.value } })} /></Cell>
                  </Row>
                ) : (
                  <Row key={i.invoiceId} index={n}>
                    <Cell className="font-mono text-xs">{i.number}</Cell>
                    <Cell>{shortDate(i.date)}</Cell>
                    <Cell className="font-mono">{money(i.claimed)}</Cell>
                    <Cell className="font-mono">{i.approved !== undefined ? money(i.approved) : "—"}</Cell>
                    <Cell className="font-mono">{i.denied ? money(i.denied) : "—"}</Cell>
                    <Cell className="text-xs">{i.denied ? `${i.action === "rebill" ? "billed to patient" : "written off"}${i.reason ? ` — ${i.reason}` : ""}` : ""}</Cell>
                    <Cell>{current.status === "Draft" && current.items.length > 1 && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => void removeFromClaim(current, i.invoiceId).then((r) => say(r, `${i.number} taken off the claim.`))}>Remove</button>}</Cell>
                  </Row>
                );
              })}
            </Table>
            {current.status === "Adjudicated" && <p className="text-xs text-mist-500">Record the payer's payment of the approved amounts as a customer receipt against these invoices.</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

function CapitationTab({ cashAccts, say }: { cashAccts: { number: number; name: string }[]; say: Say }) {
  const p = usePayers();
  const { customerById } = useAR();
  const now = new Date();
  const [f, setF] = useState({ payerId: "", startPeriod: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`, months: 3, enrollees: 0, ratePerEnrollee: 0, receivedDate: isoDate(now), depositAccountNumber: 1010, reference: "" });
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="soft" onClick={() => void recognizeCapitation(new Date().toISOString()).then((r) => say(r, r.ok ? (r.data.months ? `${r.data.months} month(s) recognized: ${money(r.data.amount)}.` : "No months to recognize yet.") : ""))}><CalendarRange size={14} /> Recognize due months</Button>
        <Button disabled={!p.payers.length} onClick={() => { setF({ ...f, payerId: p.payers[0]?.id ?? "" }); setOpen(true); }}><Plus size={14} /> Record capitation</Button>
      </div>
      <Card className="p-0">
        {p.capitations.length === 0 ? <EmptyState title="No capitation received" hint="A payer's fixed payment per enrollee per month." /> : (
          <Table columns={["Receipt", "Payer", "Cover", "Enrollees × rate", "Amount", "Recognized", "Received"]}>
            {p.capitations.map((c, n) => {
              const done = c.entries.filter((e) => e.recognized).reduce((s, e) => s + e.amount, 0);
              return (
                <Row key={c.id} index={n}>
                  <Cell className="font-mono text-xs">{c.number}{c.reference && <span className="block text-[11px] text-mist-400">{c.reference}</span>}</Cell>
                  <Cell className="font-semibold">{customerById(c.payerCustomerId)?.name}</Cell>
                  <Cell className="text-xs">{c.entries[0]?.period} – {c.entries.at(-1)?.period}</Cell>
                  <Cell className="text-xs">{c.enrollees.toLocaleString()} × {money(c.ratePerEnrollee)}/mo</Cell>
                  <Cell className="font-mono">{money(c.amount)}</Cell>
                  <Cell className="font-mono">{money(done)}{done < c.amount && <span className="block text-[11px] text-mist-400">{money(c.amount - done)} deferred</span>}</Cell>
                  <Cell>{shortDate(c.receivedDate)}</Cell>
                </Row>
              );
            })}
          </Table>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Record capitation"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!f.payerId || f.enrollees <= 0 || f.ratePerEnrollee <= 0} onClick={() => void recordCapitation({ ...f, reference: f.reference || undefined }).then((r) => { setOpen(false); say(r, r.ok ? `${r.data.number}: ${money(r.data.amount)} — ${money(r.data.recognized)} income now, ${money(r.data.deferred)} deferred.` : ""); })}>Record</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Payer"><Select value={f.payerId} onChange={(e) => setF({ ...f, payerId: e.target.value })} options={p.payers.map((x) => ({ value: x.id, label: x.name }))} /></Field>
          <Field label="First month covered"><Input type="month" value={f.startPeriod} onChange={(e) => setF({ ...f, startPeriod: e.target.value })} /></Field>
          <Field label="Months"><Input type="number" value={f.months} onChange={(e) => setF({ ...f, months: +e.target.value })} /></Field>
          <Field label="Enrollees"><Input type="number" value={f.enrollees || ""} onChange={(e) => setF({ ...f, enrollees: +e.target.value })} /></Field>
          <Field label="Rate per enrollee per month"><Input type="number" value={f.ratePerEnrollee || ""} onChange={(e) => setF({ ...f, ratePerEnrollee: +e.target.value })} /></Field>
          <Field label="Received on"><Input type="date" value={f.receivedDate} onChange={(e) => setF({ ...f, receivedDate: e.target.value })} /></Field>
          <Field label="Deposited to"><Select value={String(f.depositAccountNumber)} onChange={(e) => setF({ ...f, depositAccountNumber: +e.target.value })} options={cashAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
          <Field label="Payer's reference"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
          <p className="text-sm text-mist-600 sm:col-span-2">Total: <b>{money(round2(f.enrollees * f.ratePerEnrollee * f.months))}</b></p>
        </div>
      </Modal>
    </div>
  );
}

function WriteOffs({ openInvoices, balance, cashAccts, say }: { openInvoices: ReturnType<typeof useAR.getState>["invoices"]; balance: (i: ReturnType<typeof useAR.getState>["invoices"][number]) => number; cashAccts: { number: number; name: string }[]; say: Say }) {
  const p = usePayers();
  const { customerById, invoices } = useAR();
  const [pick, setPick] = useState("");
  const [reason, setReason] = useState("");
  const [recover, setRecover] = useState<WriteOff | null>(null);
  const [rf, setRf] = useState({ amount: 0, depositAccountNumber: 1010, reference: "" });
  const old = useMemo(() => [...openInvoices].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()), [openInvoices]);
  const chosen = old.find((i) => i.id === pick);
  return (
    <div className="space-y-4">
      <Card>
        <p className="mb-2 text-sm font-bold text-mist-600">Write off an uncollectable balance</p>
        <div className="grid gap-3 sm:grid-cols-[2fr_3fr_auto] sm:items-end">
          <Field label="Invoice"><Select value={pick} onChange={(e) => setPick(e.target.value)} options={[{ value: "", label: "— choose —" }, ...old.map((i) => ({ value: i.id, label: `${i.number} · ${customerById(i.customerId)?.name} · ${money(balance(i))} · due ${shortDate(i.dueDate)}` }))]} /></Field>
          <Field label="Reason"><Input value={reason} placeholder="e.g. patient untraceable after 180 days" onChange={(e) => setReason(e.target.value)} /></Field>
          <Button variant="action" disabled={!chosen || !reason.trim()} onClick={() => chosen && void writeOff(chosen.id, { reason: reason.trim() }).then((r) => { if (r.ok) { setPick(""); setReason(""); } say(r, r.ok ? `Written off ${money(r.data.amount)}: ${money(r.data.fromAllowance)} from the allowance, ${money(r.data.toExpense)} to bad debt expense.` : ""); })}><ShieldAlert size={14} /> Write off</Button>
        </div>
        <p className="mt-2 text-xs text-mist-400">Needs approval rights. Charged to the Allowance for Doubtful Debts as far as it goes, the rest to Bad Debt Expense.</p>
      </Card>
      <Card className="p-0">
        {p.writeOffs.length === 0 ? <EmptyState title="No write-offs" /> : (
          <Table columns={["Invoice", "Customer", "Written off", "From allowance", "Recovered", "Reason", "By", ""]}>
            {p.writeOffs.map((w, n) => (
              <Row key={w.id} index={n}>
                <Cell className="font-mono text-xs">{invoices.find((i) => i.id === w.invoiceId)?.number}</Cell>
                <Cell className="font-semibold">{customerById(w.customerId)?.name}</Cell>
                <Cell className="font-mono">{money(w.amount)}</Cell>
                <Cell className="font-mono">{money(w.fromAllowance)}</Cell>
                <Cell className="font-mono">{w.recoveredAmount ? money(w.recoveredAmount) : "—"}</Cell>
                <Cell className="text-xs">{w.reason}</Cell>
                <Cell className="text-xs">{w.createdBy} · {shortDate(w.createdAt)}</Cell>
                <Cell>{w.recoveredAmount < w.amount && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { setRecover(w); setRf({ amount: round2(w.amount - w.recoveredAmount), depositAccountNumber: 1010, reference: "" }); }}><RotateCcw size={11} /> Recovered</button>}</Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>
      <Modal open={!!recover} onClose={() => setRecover(null)} title="Money recovered on a written-off debt"
        footer={<><Button variant="ghost" onClick={() => setRecover(null)}>Cancel</Button><Button disabled={rf.amount <= 0} onClick={() => recover && void recoverWriteOff(recover.id, { amount: rf.amount, depositAccountNumber: rf.depositAccountNumber, reference: rf.reference || undefined }).then((r) => { setRecover(null); say(r, `Recovery of ${money(rf.amount)} posted to Bad Debts Recovered.`); })}>Post recovery</Button></>}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Amount"><Input type="number" value={rf.amount || ""} onChange={(e) => setRf({ ...rf, amount: +e.target.value })} /></Field>
          <Field label="Deposited to"><Select value={String(rf.depositAccountNumber)} onChange={(e) => setRf({ ...rf, depositAccountNumber: +e.target.value })} options={cashAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
          <Field label="Reference"><Input value={rf.reference} onChange={(e) => setRf({ ...rf, reference: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

function CreditLoss({ say }: { say: Say }) {
  const p = usePayers();
  const [rates, setRates] = useState<LossRates>(p.defaultLossRates);
  const [asOf, setAsOf] = useState(isoDate(new Date()));
  const [preview, setPreview] = useState<{ buckets: LossBucket[]; required: number; previous: number; adjustment: number } | null>(null);
  const bands = p.bands.length ? p.bands : ["Current", "1-30 days", "31-60 days", "61-90 days", "Over 90 days"];
  const run = (post: boolean) => void measureCreditLoss({ asOf, rates, post }).then((r) => { if (r.ok) setPreview(r.data); say(r, r.ok ? (post ? `Allowance set to ${money(r.data.required)} (${r.data.adjustment >= 0 ? "charged" : "released"} ${money(Math.abs(r.data.adjustment))}).` : `Required allowance ${money(r.data.required)}; the books hold ${money(r.data.previous)}.`) : ""); });
  return (
    <div className="space-y-4">
      <Card>
        <p className="mb-1 text-sm font-bold text-mist-600">Provision matrix — expected loss rate by days past due</p>
        <p className="mb-3 text-xs text-mist-500">IFRS 9 simplified approach: lifetime expected credit loss on receivables, from your collection history. Payers (HMOs, NHIA) usually carry lower rates than self-paying patients.</p>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] uppercase text-mist-500"><th className="py-1">Loss rate %</th>{bands.map((b) => <th key={b} className="py-1">{b}</th>)}</tr></thead>
          <tbody>
            {(["patient", "payer"] as const).map((g) => (
              <tr key={g}><td className="py-1 pr-2 font-semibold capitalize">{g === "patient" ? "Patients & corporates" : "HMOs & NHIA"}</td>
                {bands.map((b, i) => <td key={b} className="py-1 pr-2"><Input type="number" value={rates[g][i]} onChange={(e) => setRates({ ...rates, [g]: rates[g].map((v, j) => (j === i ? +e.target.value : v)) })} /></td>)}</tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="w-44"><Field label="As of"><Input type="date" value={asOf} max={isoDate(new Date())} onChange={(e) => setAsOf(e.target.value)} /></Field></div>
          <Button variant="soft" onClick={() => run(false)}><FileCheck2 size={14} /> Preview</Button>
          <Button onClick={() => run(true)}><Gavel size={14} /> Post the adjustment</Button>
        </div>
        <p className="mt-2 text-xs text-mist-400">Posting needs approval rights: Dr 5700 Bad Debt Expense / Cr 1190 Allowance (or the reverse when the allowance falls).</p>
      </Card>
      {preview && (
        <Card className="p-0">
          <Table columns={["Group", "Band", "Balance", "Rate", "Expected loss"]}>
            {preview.buckets.filter((b) => b.balance > 0).map((b, n) => (
              <Row key={`${b.group}-${b.band}`} index={n}><Cell className="capitalize">{b.group === "patient" ? "Patients & corporates" : "HMOs & NHIA"}</Cell><Cell>{b.band}</Cell><Cell className="font-mono">{money(b.balance)}</Cell><Cell>{b.rate}%</Cell><Cell className="font-mono">{money(b.expected)}</Cell></Row>
            ))}
          </Table>
          <div className="flex flex-wrap justify-end gap-6 px-4 py-3 text-sm"><span>Required <b>{money(preview.required)}</b></span><span>In the books <b>{money(preview.previous)}</b></span><span>Adjustment <b>{money(preview.adjustment)}</b></span></div>
        </Card>
      )}
      {p.creditLossRuns.length > 0 && (
        <Card className="p-0">
          <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-600">Previous measurements</p>
          <Table columns={["As of", "Required", "Previous", "Adjustment", "By"]}>
            {p.creditLossRuns.map((r, n) => <Row key={r.id} index={n}><Cell>{shortDate(r.asOf)}</Cell><Cell className="font-mono">{money(r.required)}</Cell><Cell className="font-mono">{money(r.previous)}</Cell><Cell className="font-mono">{money(r.adjustment)}</Cell><Cell className="text-xs">{r.createdBy} · {shortDate(r.createdAt)}</Cell></Row>)}
          </Table>
        </Card>
      )}
    </div>
  );
}
