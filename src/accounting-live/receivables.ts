import { create } from "zustand";
import { docTotal, fxOf, useAR } from "@/store/accounting/useAR";
import { useIdentity } from "@/store/useIdentity";
import { accountingRequest } from "@/emr-live/client";
import type { CreditNote, Customer, CustomerReceipt, DelayedCharge, Estimate, Invoice, InvoiceReminder, RefundReceipt, RevenueSchedule, SalesLine, SalesOrder, SalesReceipt } from "@/data/accounting/receivables";
import type { CustomerType } from "@/data/accounting/receivables";
import { adoptLiveIdentity, liveChange, uuid } from "@/workforce-live/sync";
import { loadLedger } from "./ledger";

// Receivables in live mode (GET /receivables): customers, quotations, orders, invoices, receipts, credit
// notes, cash-sale and refund receipts, delayed charges, revenue schedules, reminders and statements are
// the organization's records. Each action answers at once from the checks the screens always ran (credit
// hold and limit, balances, due reminders), then the server checks again, numbers the document and posts
// its journal entry; the books reload after every change. Reminders and statements record that they were
// sent — nothing is mailed.

type Versioned = { version?: number };
type ApiAR = {
  customers: (Customer & Versioned)[]; estimates: (Estimate & Versioned)[]; salesOrders: (SalesOrder & Versioned)[]; invoices: (Invoice & Versioned)[]; receipts: CustomerReceipt[];
  creditNotes: (CreditNote & Versioned)[]; salesReceipts: SalesReceipt[]; refundReceipts: RefundReceipt[]; revenueSchedules: RevenueSchedule[]; delayedCharges: DelayedCharge[];
  reminders: InvoiceReminder[]; statementLog: { customerId: string; to: string; sentAt: string; by: string }[];
};

export const useLiveARMeta = create<{ loaded: boolean }>(() => ({ loaded: false }));
const noNull = <T extends object>(row: T) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && v !== undefined)) as T;

export async function loadReceivables() {
  const { data } = await accountingRequest<{ data: ApiAR }>("/receivables");
  useLiveARMeta.setState({ loaded: true });
  useAR.setState({
    customers: data.customers.map((c) => noNull(c)), estimates: data.estimates.map((d) => noNull(d)), salesOrders: data.salesOrders.map((d) => noNull(d)), invoices: data.invoices.map((d) => noNull(d)),
    receipts: data.receipts.map((r) => noNull(r)), creditNotes: data.creditNotes.map((d) => noNull(d)), salesReceipts: data.salesReceipts.map((d) => noNull(d)), refundReceipts: data.refundReceipts.map((d) => noNull(d)),
    revenueSchedules: data.revenueSchedules, delayedCharges: data.delayedCharges.map((d) => noNull(d)), reminders: data.reminders, statementLog: data.statementLog,
  });
  adoptLiveIdentity(null);
}

/** After a receivables change: the documents and the journal they posted to. */
const reload = async () => { await Promise.all([loadReceivables(), loadLedger()]); };
const AR = () => useAR.getState();
const post = (path: string, body: unknown = {}) => accountingRequest(`/receivables${path}`, { method: "POST", body });
const patch = (path: string, body: unknown, version: number) => accountingRequest(`/receivables${path}`, { method: "PATCH", body, version });
const defined = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));
const versionOf = (list: ({ id: string } & Versioned)[], id: string) => list.find((x) => x.id === id)?.version ?? 1;
const lineBody = (lines: SalesLine[]) => lines.map((l) => defined({ id: l.id, accountNumber: l.accountNumber, description: l.description, qty: l.qty, unitPrice: l.unitPrice, taxRateId: l.taxRateId, taxRateIds: l.taxRateIds?.length ? l.taxRateIds : undefined }));
const can = (p: "approve") => { const r = useIdentity.getState().user.financeRole; return r === "Finance Controller" || (p === "approve" && r === "Approver"); };
const customerBody = (c: Partial<Customer> & { openingBalance?: number }) => defined({ name: c.name, type: c.type, email: c.email, phone: c.phone, address: c.address, city: c.city, currency: c.currency, paymentTermsDays: c.paymentTermsDays, paymentTermId: c.paymentTermId, creditLimit: c.creditLimit || undefined, openingBalance: c.openingBalance || undefined });

export function goLiveReceivables() {
  useAR.setState({
    addCustomer: (c) => {
      const id = uuid();
      void liveChange(() => post("/customers", { id, ...customerBody(c) }), reload);
      return id;
    },
    updateCustomer: (id, change) => {
      const body = defined({ name: change.name, type: change.type, email: change.email, phone: change.phone, address: change.address, city: change.city, currency: change.currency, paymentTermsDays: change.paymentTermsDays, paymentTermId: change.paymentTermId, creditLimit: change.creditLimit, creditHold: change.creditHold });
      void liveChange(() => patch(`/customers/${id}`, body, versionOf(AR().customers, id)), reload, () => useAR.setState((s) => ({ customers: s.customers.map((c) => (c.id === id ? { ...c, ...change } : c)) })));
    },
    importCustomers: (rows) => {
      const types: CustomerType[] = ["Patient", "NHIS", "HMO", "Corporate", "Walk-in"];
      const errors: string[] = [];
      const good = rows.flatMap((r, i) => {
        const name = (r.name ?? "").trim();
        if (!name) { errors.push(`Row ${i + 2}: missing name`); return []; }
        const type = types.find((t) => t.toLowerCase() === (r.type ?? "").toLowerCase()) ?? "Corporate";
        return [customerBody({ name, type, email: r.email || undefined, phone: r.phone || undefined, city: r.city || undefined, paymentTermsDays: Number(r.payment_terms_days ?? r["payment terms"] ?? 30) || 30, creditLimit: Number(r.credit_limit ?? r["credit limit"] ?? 0) || 0, openingBalance: Number(r.opening_balance ?? r["opening balance"] ?? 0) || 0 })];
      });
      if (good.length) void liveChange(() => post("/customers/import", { rows: good }), reload);
      return { added: good.length, errors };
    },

    createEstimate: (input) => { const id = uuid(); void liveChange(() => post("/estimates", defined({ id, customerId: input.customerId, date: input.date, expiryDays: input.expiryDays, lines: lineBody(input.lines), notes: input.notes })), reload); return id; },
    updateEstimate: (id, change) => { void liveChange(() => patch(`/docs/estimate/${id}`, defined({ date: change.date, expiryDate: change.expiryDate, lines: change.lines ? lineBody(change.lines) : undefined, notes: change.notes }), versionOf(AR().estimates, id)), reload); },
    setEstimateStatus: (id, status) => { void liveChange(() => post(`/estimates/${id}/status`, { status }), reload); },
    convertEstimateToOrder: (id) => { const newId = uuid(); void liveChange(() => post(`/estimate/${id}/convert`, { to: "sales-order", newId }), reload); return newId; },
    convertEstimateToInvoice: (id) => { const newId = uuid(); void liveChange(() => post(`/estimate/${id}/convert`, { to: "invoice", newId }), reload); return newId; },
    createSalesOrder: (input) => { const id = uuid(); void liveChange(() => post("/sales-orders", defined({ id, customerId: input.customerId, date: input.date, lines: lineBody(input.lines), notes: input.notes })), reload); return id; },
    confirmSalesOrder: (id) => { void liveChange(() => post(`/sales-orders/${id}/status`, { status: "Confirmed" }), reload); },
    cancelSalesOrder: (id) => { void liveChange(() => post(`/sales-orders/${id}/status`, { status: "Cancelled" }), reload); },
    convertOrderToInvoice: (id) => { const newId = uuid(); void liveChange(() => post(`/sales-order/${id}/convert`, { to: "invoice", newId }), reload); return newId; },

    createInvoice: (input) => {
      const id = uuid();
      void liveChange(() => post("/invoices", defined({
        id, customerId: input.customerId, date: input.date, dueDate: input.dueDate, lines: lineBody(input.lines), notes: input.notes, salesOrderId: input.salesOrderId, currency: input.currency,
        exchangeRate: input.currency && input.currency !== "NGN" ? input.exchangeRate : undefined, deferOverMonths: input.deferOverMonths || undefined, recurEveryMonths: input.recurEveryMonths || undefined,
        recurEndDate: input.recurEndDate, delayedChargeIds: input.delayedChargeIds?.length ? input.delayedChargeIds : undefined, projectId: input.projectId, timeEntryIds: input.timeEntryIds?.length ? input.timeEntryIds : undefined,
      })), reload);
      return id;
    },
    updateInvoice: (id, change) => { void liveChange(() => patch(`/docs/invoice/${id}`, defined({ date: change.date, dueDate: change.dueDate, lines: change.lines ? lineBody(change.lines) : undefined, notes: change.notes }), versionOf(AR().invoices, id)), reload); },
    issueInvoice: (id, opts) => {
      const inv = AR().invoices.find((i) => i.id === id);
      if (!inv || inv.status !== "Draft") return { ok: false, error: "Only a draft invoice can be issued." };
      if (!inv.lines.length || docTotal(inv.lines) <= 0) return { ok: false, error: "Add at least one line with an amount." };
      const credit = AR().creditCheck(inv.customerId, (docTotal(inv.lines) - inv.amountPaid) * fxOf(inv));
      if (credit.blocked && AR().customerById(inv.customerId)?.creditHold) return { ok: false, error: credit.reason };
      if (credit.blocked && !opts?.overrideCredit) return { ok: false, error: credit.reason };
      if (credit.blocked && !can("approve")) return { ok: false, error: "Going over a credit limit needs approval rights." };
      void liveChange(() => post(`/invoices/${id}/issue`, credit.blocked ? { overrideCredit: true } : {}), reload);
      return { ok: true, creditWarning: credit.blocked ? credit.reason : undefined };
    },
    voidInvoice: (id) => {
      const inv = AR().invoices.find((i) => i.id === id);
      if (!inv) return { ok: false, error: "Not found." };
      if (inv.amountPaid > 0) return { ok: false, error: "Un-apply receipts and credit notes before voiding." };
      void liveChange(() => post(`/void/invoice/${id}`), reload);
      return { ok: true };
    },

    recordReceipt: (input) => {
      if (!AR().customerById(input.customerId)) return { ok: false, error: "Customer not found." };
      void liveChange(() => post("/receipts", defined({
        id: uuid(), customerId: input.customerId, date: input.date, method: input.method, depositAccountNumber: input.depositAccountNumber, amount: input.amount,
        allocations: input.allocations.filter((a) => a.amount > 0 || (a.discount ?? 0) > 0).map((a) => defined({ invoiceId: a.invoiceId, amount: a.amount, discount: a.discount || undefined })),
        settlementRate: input.settlementRate, reference: input.reference, notes: input.notes,
      })), reload);
      return { ok: true };
    },

    createCreditNote: (input) => { const id = uuid(); void liveChange(() => post("/credit-notes", defined({ id, customerId: input.customerId, invoiceId: input.invoiceId, date: input.date, lines: lineBody(input.lines), reason: input.reason, notes: input.notes })), reload); return id; },
    applyCreditNote: (cnId, invoiceId, amount) => { void liveChange(() => post(`/credit-notes/${cnId}/apply`, { invoiceId, amount }), reload); },
    refundCreditNote: (cnId, amount, fromAccountNumber) => { void liveChange(() => post(`/credit-notes/${cnId}/refund`, { amount, fromAccountNumber }), reload); },

    createSalesReceipt: (input) => {
      if (!input.lines.length || docTotal(input.lines) <= 0) return { ok: false, error: "Add at least one line with an amount." };
      const id = uuid();
      void liveChange(() => post("/sales-receipts", defined({ id, customerId: input.customerId, customerName: input.customerId ? undefined : input.customerName, date: input.date, method: input.method, depositAccountNumber: input.depositAccountNumber, lines: lineBody(input.lines), notes: input.notes })), reload);
      return { ok: true, id };
    },
    voidSalesReceipt: (id) => {
      const sr = AR().salesReceipts.find((x) => x.id === id);
      if (!sr || sr.status === "Void") return { ok: false, error: "Not found." };
      void liveChange(() => post(`/void/sales-receipt/${id}`), reload);
      return { ok: true };
    },
    createRefundReceipt: (input) => {
      if (!AR().customerById(input.customerId)) return { ok: false, error: "Customer not found." };
      if (!input.lines.length || docTotal(input.lines) <= 0) return { ok: false, error: "Add at least one line with an amount." };
      const id = uuid();
      void liveChange(() => post("/refund-receipts", defined({ id, customerId: input.customerId, date: input.date, method: input.method, fromAccountNumber: input.fromAccountNumber, lines: lineBody(input.lines), reason: input.reason, notes: input.notes })), reload);
      return { ok: true, id };
    },
    voidRefundReceipt: (id) => {
      const rr = AR().refundReceipts.find((x) => x.id === id);
      if (!rr || rr.status === "Void") return { ok: false, error: "Not found." };
      void liveChange(() => post(`/void/refund-receipt/${id}`), reload);
      return { ok: true };
    },

    addDelayedCharge: (input) => { void liveChange(() => post("/delayed-charges", defined({ id: uuid(), ...input })), reload); },
    removeDelayedCharge: (id) => { void liveChange(() => post(`/delayed-charges/${id}/remove`), reload); },

    revalueForeignAr: (asOf, rates) => {
      // The same calculation the server makes, for the screen's summary; the server posts the entries.
      let adjusted = 0;
      let net = 0;
      for (const inv of AR().invoices.filter((i) => i.currency !== "NGN" && (i.status === "Open" || i.status === "Partially Paid" || i.status === "Overdue"))) {
        const to = rates[inv.currency];
        if (!to || Math.abs(to - fxOf(inv)) < 0.005) continue;
        const delta = Math.round((docTotal(inv.lines) - inv.amountPaid) * (to - fxOf(inv)) * 100) / 100;
        if (Math.abs(delta) < 0.005) continue;
        adjusted += 1;
        net = Math.round((net + delta) * 100) / 100;
      }
      if (adjusted) void liveChange(() => post("/revaluation", { asOf, rates }), reload);
      return { module: "AR", adjusted, net };
    },
    runRecurringInvoices: (asOf) => {
      const due = AR().invoices.filter((i) => i.isRecurring && i.recurrenceNextDate && new Date(i.recurrenceNextDate).getTime() <= new Date(asOf).getTime()).map((i) => i.id);
      void liveChange(() => post("/invoices/recurring/run", { asOf }), reload);
      return { created: due };
    },
    recognizeRevenue: (scheduleId, period) => {
      const sch = AR().revenueSchedules.find((x) => x.id === scheduleId);
      if (!sch) return { ok: false, error: "Schedule not found." };
      if (!sch.entries.some((e) => e.period === period && !e.recognized)) return { ok: false, error: "Nothing to recognise for that period." };
      void liveChange(() => post(`/revenue-schedules/${scheduleId}/recognize`, { period }), reload);
      return { ok: true };
    },

    sendReminder: (invoiceId) => {
      const inv = AR().invoices.find((i) => i.id === invoiceId);
      const due = inv && AR().reminderDue(inv);
      if (!due) return { ok: false };
      void liveChange(() => post(`/invoices/${invoiceId}/reminder`), reload,
        () => useAR.setState((s) => ({ reminders: [{ invoiceId, level: due.level, tone: due.tone, sentAt: new Date().toISOString(), sentBy: useIdentity.getState().user.name }, ...s.reminders] })));
      return { ok: true, level: due.level };
    },
    runReminderRun: () => {
      const sent = AR().invoices.filter((i) => AR().reminderDue(i)).length;
      if (sent) void liveChange(() => post("/reminders/run"), reload);
      return { sent };
    },
    markStatementSent: (customerId) => {
      const cust = AR().customerById(customerId);
      if (!cust?.email) return { ok: false };
      void liveChange(() => post(`/customers/${customerId}/statement`), reload);
      return { ok: true, to: cust.email };
    },
  });
}

export function clearReceivables() {
  useLiveARMeta.setState({ loaded: false });
  useAR.setState({ customers: [], estimates: [], salesOrders: [], invoices: [], receipts: [], creditNotes: [], salesReceipts: [], refundReceipts: [], revenueSchedules: [], delayedCharges: [], reminders: [], statementLog: [] });
}
