import { useMemo, useState } from "react";
import { ArrowLeft, Banknote, CalendarClock, FileText, Printer, ReceiptText, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Button, PageHeader, statusTone } from "@/components/ui/primitives";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/Modal";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { invoiceStatusFor, type PaymentMethod } from "@/billing/domain";
import { minorMoney, paymentMethodLabel, useRevenueCycle } from "@/billing/useRevenueCycle";
import { useEmr } from "@/store/useEmr";
import { activeFacility } from "@/platform/tenantRuntime";
import { dateTime, isoDate, shortDate } from "@/lib/format";
import { getRevenueCycleApi } from "@/billing/runtime";

const paymentMethods: PaymentMethod[] = ["CASH", "CARD_POS", "BANK_TRANSFER", "MOBILE_MONEY", "INSURANCE", "OTHER"];

export default function BillingInvoiceDetail() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const invoice = useRevenueCycle((state) => state.invoices.find((item) => item.id === invoiceId));
  const account = useRevenueCycle((state) => state.accounts.find((item) => item.id === invoice?.accountId));
  const payments = useRevenueCycle((state) => state.payments);
  const allocations = useRevenueCycle((state) => state.allocations);
  const receipts = useRevenueCycle((state) => state.receipts);
  const auditEvents = useRevenueCycle((state) => state.auditEvents);
  const patient = useEmr((state) => state.patients.find((item) => item.id === invoice?.patientId));
  const encounter = useEmr((state) => state.encounters.find((item) => item.id === invoice?.encounterId));
  const facility = activeFacility();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [error, setError] = useState("");
  const [paymentPending, setPaymentPending] = useState(false);
  const [paymentRequestId, setPaymentRequestId] = useState("");
  const [form, setForm] = useState({ amount: "", method: "CASH" as PaymentMethod, paymentDate: isoDate(new Date()), reference: "", receivingAccount: "Main cash account", notes: "" });

  const invoicePayments = useMemo(() => {
    if (!invoice) return [];
    const paymentIds = allocations.filter((allocation) => allocation.invoiceId === invoice.id).map((allocation) => allocation.paymentId);
    return payments.filter((payment) => paymentIds.includes(payment.id));
  }, [allocations, invoice, payments]);
  const invoiceAudit = auditEvents.filter((event) => event.resourceId === invoice?.id || event.accountId === invoice?.accountId);
  const amountMinor = Math.round((Number(form.amount) || 0) * 100);
  const projectedStatus = invoice ? invoiceStatusFor(invoice.totalMinor, invoice.paidMinor + Math.min(amountMinor, invoice.balanceMinor)) : "ISSUED";

  if (!invoice || !account) {
    return <div className="card py-16 text-center"><FileText size={30} className="mx-auto mb-3 text-mist-300" /><h1 className="font-display text-xl font-bold text-mist-900">Invoice not found</h1><p className="mt-1 text-sm text-mist-500">It may belong to another tenant or no longer be available.</p><Button className="mt-4" onClick={() => navigate("/billing")}><ArrowLeft size={14} /> Back to billing</Button></div>;
  }
  const currentInvoice = invoice;

  const canPay = invoice.balanceMinor > 0 && ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status);

  function openPayment() {
    setError("");
    setPaymentRequestId(`payment:${currentInvoice.id}:${globalThis.crypto.randomUUID()}`);
    setForm({ amount: (currentInvoice.balanceMinor / 100).toFixed(2), method: "CASH", paymentDate: isoDate(new Date()), reference: "", receivingAccount: "Main cash account", notes: "" });
    setPaymentOpen(true);
  }

  async function submitPayment() {
    setError("");
    setPaymentPending(true);
    try {
      await getRevenueCycleApi().recordPayment({ invoiceId: currentInvoice.id, amountMinor, method: form.method, paymentDate: new Date(`${form.paymentDate}T12:00:00`).toISOString(), reference: form.reference, receivingAccount: form.receivingAccount, notes: form.notes, idempotencyKey: paymentRequestId });
      setPaymentOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment could not be recorded.");
    } finally {
      setPaymentPending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={`Invoice ${invoice.number}`}
        subtitle={`${shortDate(invoice.issuedAt)} · ${patient ? `${patient.firstName} ${patient.lastName}` : invoice.patientId}`}
        actions={<><Button variant="ghost" onClick={() => navigate("/billing")}><ArrowLeft size={14} /> Billing worklist</Button><Button variant="soft" onClick={() => window.print()}><Printer size={14} /> Print</Button>{canPay && <Button onClick={openPayment}><Banknote size={14} /> Record payment</Button>}</>}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <section className="card overflow-hidden p-0">
            <div className="border-b border-mist-100 bg-gradient-to-r from-brand-50 to-white px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="font-display text-xl font-bold text-mist-900">{facility.name}</p><p className="mt-1 text-sm text-mist-500">{facility.code} · {facility.state}, {facility.country}</p></div>
                <div className="text-right"><Badge tone={statusTone(invoice.status.replaceAll("_", " "))}>{invoice.status.replaceAll("_", " ")}</Badge><p className="mt-2 font-mono text-xs text-mist-500">{invoice.number}</p></div>
              </div>
            </div>
            <div className="grid gap-5 px-6 py-5 sm:grid-cols-2">
              <div><p className="text-[11px] font-bold uppercase tracking-wider text-mist-400">Patient</p><p className="mt-1 font-semibold text-mist-900">{patient ? `${patient.firstName} ${patient.lastName}` : "Unknown patient"}</p><p className="text-sm text-mist-500">MRN {patient?.mrn ?? "—"}</p><p className="text-sm text-mist-500">Payer: {invoice.payer}</p></div>
              <div className="sm:text-right"><p className="text-[11px] font-bold uppercase tracking-wider text-mist-400">Invoice information</p><p className="mt-1 text-sm text-mist-600">Invoice date: {shortDate(invoice.issuedAt)}</p><p className="text-sm text-mist-600">Service date: {shortDate(invoice.lines[0]?.serviceDate ?? invoice.issuedAt)}</p><p className="font-mono text-xs text-mist-500">Encounter {invoice.encounterId}</p></div>
            </div>
          </section>

          <Table columns={["Description", "Department", <span key="qty" className="block text-right">Qty</span>, <span key="unit" className="block text-right">Unit price</span>, <span key="amount" className="block text-right">Amount</span>]} caption="Invoice line items">
            {invoice.lines.map((line, index) => <Row key={line.id} index={index}><Cell><span className="font-semibold text-mist-800">{line.description}</span><span className="block font-mono text-[10px] text-mist-400">{line.serviceCode}</span></Cell><Cell>{line.department}</Cell><Cell className="text-right tabular-nums">{line.quantity}</Cell><Cell className="text-right tabular-nums">{minorMoney(line.unitPriceMinor, invoice.currency)}</Cell><Cell className="text-right font-semibold tabular-nums">{minorMoney(line.netAmountMinor, invoice.currency)}</Cell></Row>)}
          </Table>

          <section className="card">
            <div className="ml-auto max-w-sm space-y-2 text-sm">
              <SummaryLine label="Subtotal" value={minorMoney(invoice.subtotalMinor, invoice.currency)} />
              <SummaryLine label="Discount" value={minorMoney(invoice.discountMinor, invoice.currency)} />
              <SummaryLine label="Tax" value={minorMoney(invoice.taxMinor, invoice.currency)} />
              <SummaryLine label="Total" value={minorMoney(invoice.totalMinor, invoice.currency)} strong />
              <SummaryLine label="Paid" value={minorMoney(invoice.paidMinor, invoice.currency)} tone="brand" />
              <SummaryLine label="Outstanding" value={minorMoney(invoice.balanceMinor, invoice.currency)} tone={invoice.balanceMinor > 0 ? "action" : "brand"} strong />
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2"><ReceiptText size={17} className="text-brand-600" /><div><h2 className="font-display font-bold text-mist-900">Payment history</h2><p className="text-xs text-mist-500">Immutable receipts and allocations recorded against this invoice.</p></div></div>
            <Table columns={["Receipt", "Date", "Method", "Reference", "Received by", <span key="amount" className="block text-right">Amount</span>, "Status"]} caption="Payment history">
              {invoicePayments.length === 0 && <EmptyRow colSpan={7}>No payments have been recorded.</EmptyRow>}
              {invoicePayments.map((payment, index) => { const receipt = receipts.find((item) => item.paymentId === payment.id); return <Row key={payment.id} index={index}><Cell className="font-mono text-xs">{receipt?.number ?? "—"}</Cell><Cell>{dateTime(payment.paymentDate)}</Cell><Cell>{paymentMethodLabel[payment.method]}</Cell><Cell className="font-mono text-xs">{payment.reference ?? "—"}</Cell><Cell>{payment.receivedBy}</Cell><Cell className="text-right font-semibold tabular-nums">{minorMoney(payment.amountMinor, payment.currency)}</Cell><Cell><Badge tone={payment.status === "SUCCEEDED" ? "brand" : "action"}>{payment.status}</Badge></Cell></Row>; })}
            </Table>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2"><ShieldCheck size={17} className="text-brand-600" /><div><h2 className="font-display font-bold text-mist-900">Audit trail</h2><p className="text-xs text-mist-500">Separate, append-only financial activity for this patient account.</p></div></div>
            <div className="card divide-y divide-mist-100 p-0">{invoiceAudit.length === 0 && <p className="p-5 text-sm text-mist-400">No billing audit events are available for this migrated invoice.</p>}{invoiceAudit.map((event) => <div key={event.id} className="grid gap-2 px-4 py-3 md:grid-cols-[150px_1fr_180px]"><div className="text-xs text-mist-400">{dateTime(event.timestamp)}</div><div><p className="text-sm font-semibold text-mist-800">{event.action.replaceAll("_", " ")}</p><p className="font-mono text-[10px] text-mist-400">{event.resourceType} · {event.resourceId} · {event.correlationId}</p></div><div className="text-sm text-mist-500 md:text-right">{event.actor}<span className="block text-[11px]">{event.role}</span></div></div>)}</div>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <InfoCard icon={<WalletCardsIcon />} title="Financial summary">
            <SummaryLine label="Total" value={minorMoney(invoice.totalMinor, invoice.currency)} />
            <SummaryLine label="Paid" value={minorMoney(invoice.paidMinor, invoice.currency)} tone="brand" />
            <SummaryLine label="Outstanding" value={minorMoney(invoice.balanceMinor, invoice.currency)} tone={invoice.balanceMinor > 0 ? "action" : "brand"} strong />
            <div className="mt-3 border-t border-mist-100 pt-3"><Badge tone={statusTone(invoice.status.replaceAll("_", " "))}>{invoice.status.replaceAll("_", " ")}</Badge></div>
          </InfoCard>
          <InfoCard icon={<Stethoscope size={17} />} title="Encounter information"><InfoLine label="Encounter" value={invoice.encounterId} mono /><InfoLine label="Visit" value={account.visitType} /><InfoLine label="Provider" value={encounter?.provider ?? account.attendingProvider ?? "—"} /><InfoLine label="Service date" value={shortDate(encounter?.date ?? invoice.issuedAt)} /><InfoLine label="Billing readiness" value={account.readinessReasons.length ? account.readinessReasons.join(" · ") : "Ready"} /></InfoCard>
          <InfoCard icon={<UserRound size={17} />} title="Patient account"><InfoLine label="Account" value={account.number} mono /><InfoLine label="MRN" value={patient?.mrn ?? "—"} mono /><InfoLine label="Payer" value={account.payer} /><InfoLine label="Responsibility" value={account.payer === "Out of Pocket" ? "Patient" : account.payer} /></InfoCard>
          <InfoCard icon={<CalendarClock size={17} />} title="Quick actions"><div className="grid gap-2">{canPay && <Button className="w-full justify-center" onClick={openPayment}><Banknote size={14} /> Record payment</Button>}<Button variant="soft" className="w-full justify-center" onClick={() => window.print()}><Printer size={14} /> Print invoice</Button></div></InfoCard>
        </aside>
      </div>

      <Modal open={paymentOpen} onClose={() => !paymentPending && setPaymentOpen(false)} title="Record Payment" footer={<><Button variant="ghost" disabled={paymentPending} onClick={() => setPaymentOpen(false)}>Cancel</Button><Button disabled={paymentPending || amountMinor <= 0 || amountMinor > invoice.balanceMinor || !form.receivingAccount || !paymentRequestId} onClick={submitPayment}>{paymentPending ? "Recording…" : `Record ${amountMinor > 0 ? minorMoney(amountMinor, invoice.currency) : "payment"}`}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-mist-50 p-3 text-sm"><div><p className="text-[10px] font-bold uppercase text-mist-400">Invoice total</p><p className="mt-1 font-semibold">{minorMoney(invoice.totalMinor, invoice.currency)}</p></div><div><p className="text-[10px] font-bold uppercase text-mist-400">Already paid</p><p className="mt-1 font-semibold text-brand-700">{minorMoney(invoice.paidMinor, invoice.currency)}</p></div><div><p className="text-[10px] font-bold uppercase text-mist-400">Outstanding</p><p className="mt-1 font-bold text-action-700">{minorMoney(invoice.balanceMinor, invoice.currency)}</p></div></div>
          <Field label="Amount received"><Input autoFocus type="number" min="0.01" max={(invoice.balanceMinor / 100).toFixed(2)} step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Payment method"><Select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value as PaymentMethod })} options={paymentMethods.map((method) => ({ value: method, label: paymentMethodLabel[method] }))} /></Field><Field label="Transaction date"><Input type="date" value={form.paymentDate} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} /></Field></div>
          <Field label="Reference (optional)"><Input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="Transfer, POS or insurer reference" /></Field>
          <Field label="Receiving account"><Select value={form.receivingAccount} onChange={(event) => setForm({ ...form, receivingAccount: event.target.value })} options={["Main cash account", "POS clearing account", "Primary bank account", "Mobile money clearing"]} /></Field>
          <Field label="Notes (optional)"><Textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Additional payment context" /></Field>
          {amountMinor > invoice.balanceMinor && <p className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">Amount received cannot exceed the outstanding balance.</p>}
          {error && <p className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{error}</p>}
          <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm"><span className="text-brand-700">Calculated payment status</span><b className="text-brand-800">{projectedStatus.replaceAll("_", " ")}</b></div>
        </div>
      </Modal>
    </div>
  );
}

function SummaryLine({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "brand" | "action" }) {
  return <div className={`flex items-center justify-between gap-4 ${strong ? "border-t border-mist-200 pt-2 font-bold" : ""}`}><span className="text-mist-500">{label}</span><span className={`tabular-nums ${tone === "brand" ? "text-brand-700" : tone === "action" ? "text-action-700" : "text-mist-900"}`}>{value}</span></div>;
}

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="card"><div className="mb-3 flex items-center gap-2 text-brand-700">{icon}<h2 className="font-display font-bold text-mist-900">{title}</h2></div><div className="space-y-2 text-sm">{children}</div></section>;
}

function InfoLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex items-start justify-between gap-3"><span className="text-mist-400">{label}</span><span className={`text-right font-medium text-mist-700 ${mono ? "font-mono text-xs" : ""}`}>{value}</span></div>;
}

function WalletCardsIcon() { return <ReceiptText size={17} />; }
