import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { useLedger } from "@/store/accounting/useLedger";
import { useTax } from "@/store/accounting/useTax";
import { useAccountingSettings } from "@/store/accounting/useAccountingSettings";
import { useProjects } from "@/store/accounting/useProjects";
import { ACCT } from "@/data/accounting/coa";
import {
  seedCustomers,
  seedInvoices,
  seedReceipts,
  seedEstimates,
  seedSalesOrders,
  seedCreditNotes,
  seedRevenueSchedules,
  seedReminders,
  seedSalesReceipts,
  seedRefundReceipts,
  seedDelayedCharges,
  type Customer,
  type InvoiceReminder,
  type CustomerType,
  type SalesLine,
  type Estimate,
  type SalesOrder,
  type Invoice,
  type CustomerReceipt,
  type ReceiptAllocation,
  type CreditNote,
  type RevenueSchedule,
  type SalesReceipt,
  type RefundReceipt,
  type DelayedCharge,
} from "@/data/accounting/receivables";

const rid = () => Math.random().toString(36).slice(2, 9);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const daysAdd = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 864e5).toISOString();
const monthsAdd = (iso: string, m: number) => { const d = new Date(iso); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m, d.getUTCDate())).toISOString(); };
const ym = (iso: string) => { const d = new Date(iso); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

const lineAmount = (l: SalesLine) => round2(l.qty * l.unitPrice);
export const docSubtotal = (lines: SalesLine[]) => round2(lines.reduce((n, l) => n + lineAmount(l), 0));
export const docTax = (lines: SalesLine[]) => round2(lines.reduce((n, l) => n + useTax.getState().taxOn(lineAmount(l), l.taxRateId), 0));
export const docTotal = (lines: SalesLine[]) => round2(docSubtotal(lines) + docTax(lines));

/** the FX rate a document was booked at; NGN documents are 1:1 */
export const fxOf = (inv: Pick<Invoice, "exchangeRate">) => inv.exchangeRate || 1;
/** an invoice's outstanding balance, converted to the reporting currency */
export const invoiceBalanceNgn = (inv: Invoice) => round2((docTotal(inv.lines) - inv.amountPaid) * fxOf(inv));

const arAccountForType = (t: CustomerType) => (t === "NHIS" ? ACCT.arNhis : t === "HMO" ? ACCT.arHmo : ACCT.arPatients);

function postInvoiceJE(inv: Invoice, cust: Customer, schedule?: RevenueSchedule) {
  const led = useLedger.getState();
  const rate = fxOf(inv);
  const total = round2(docTotal(inv.lines) * rate);
  const tax = round2(docTax(inv.lines) * rate);
  const net = round2(total - tax);
  const suffix = inv.currency !== "NGN" ? ` (${inv.currency} ${docTotal(inv.lines).toLocaleString()} @ ${rate})` : "";
  const pj = inv.projectId;
  const lines = [
    { accountNumber: cust.arAccountNumber, debit: total, credit: 0, description: `${inv.number} — ${cust.name}${suffix}`, customerId: cust.id },
  ] as { accountNumber: number; debit: number; credit: number; description?: string; customerId?: string; projectId?: string }[];
  if (schedule) {
    lines.push({ accountNumber: schedule.deferredAccountNumber, debit: 0, credit: net, description: `Deferred revenue — ${inv.number}`, customerId: cust.id, projectId: pj });
  } else {
    for (const l of inv.lines) lines.push({ accountNumber: l.accountNumber, debit: 0, credit: round2(lineAmount(l) * rate), description: l.description, customerId: cust.id, projectId: pj });
  }
  if (tax > 0) lines.push({ accountNumber: ACCT.vatPayable, debit: 0, credit: tax, description: `Output VAT — ${inv.number}`, customerId: cust.id });
  return led.postJournal({ date: inv.date, source: "Invoice", memo: `Invoice ${inv.number} — ${cust.name}`, reference: inv.number, lines });
}

/** posts a customer receipt with realised FX gain/loss on foreign settlements + early-pay discount */
function postReceiptJE(r: CustomerReceipt, cust: Customer, invLookup: (id: string) => Invoice | undefined) {
  let arReliefNgn = 0;
  let fxDiff = 0;
  let bankFromAlloc = 0;
  let discountNgn = 0;
  for (const a of r.allocations) {
    const inv = invLookup(a.invoiceId);
    const bookRate = inv ? fxOf(inv) : 1;
    const setRate = inv && inv.currency !== "NGN" ? r.settlementRate ?? bookRate : 1;
    const disc = a.discount ?? 0;
    arReliefNgn += (a.amount + disc) * bookRate; // discount also relieves the receivable
    discountNgn += disc * bookRate;
    fxDiff += a.amount * (setRate - bookRate);
    bankFromAlloc += a.amount * setRate;
  }
  const unallocatedNgn = round2(r.amount - bankFromAlloc);
  const creditAr = round2(arReliefNgn + Math.max(unallocatedNgn, 0));
  fxDiff = round2(fxDiff);
  discountNgn = round2(discountNgn);
  const lines: { accountNumber: number; debit: number; credit: number; description?: string; customerId?: string }[] = [
    { accountNumber: r.depositAccountNumber, debit: r.amount, credit: 0, description: `${r.method} — ${cust.name}` },
  ];
  if (discountNgn > 0.005) lines.push({ accountNumber: ACCT.discountsWaivers, debit: discountNgn, credit: 0, description: "Early-payment discount", customerId: cust.id });
  lines.push({ accountNumber: cust.arAccountNumber, debit: 0, credit: creditAr, description: `Applied to ${r.allocations.length} invoice(s)`, customerId: cust.id });
  if (fxDiff > 0.005) lines.push({ accountNumber: ACCT.fxGain, debit: 0, credit: fxDiff, description: "Realised FX gain on settlement" });
  else if (fxDiff < -0.005) lines.push({ accountNumber: ACCT.fxLoss, debit: -fxDiff, credit: 0, description: "Realised FX loss on settlement" });
  return useLedger.getState().postJournal({ date: r.date, source: "Customer Payment", memo: `Receipt ${r.number} — ${cust.name}`, reference: r.number, lines });
}

function postSalesReceiptJE(sr: SalesReceipt, who: string) {
  const total = docTotal(sr.lines);
  const tax = docTax(sr.lines);
  const lines: { accountNumber: number; debit: number; credit: number; description?: string }[] = [
    { accountNumber: sr.depositAccountNumber, debit: total, credit: 0, description: `${sr.method} — ${who}` },
    ...sr.lines.map((l) => ({ accountNumber: l.accountNumber, debit: 0, credit: lineAmount(l), description: l.description })),
  ];
  if (tax > 0) lines.push({ accountNumber: ACCT.vatPayable, debit: 0, credit: tax, description: `Output VAT — ${sr.number}` });
  return useLedger.getState().postJournal({ date: sr.date, source: "Sales Receipt", memo: `Sales receipt ${sr.number} — ${who}`, reference: sr.number, lines });
}

function postRefundReceiptJE(rr: RefundReceipt, cust: Customer) {
  const total = docTotal(rr.lines);
  const tax = docTax(rr.lines);
  const lines: { accountNumber: number; debit: number; credit: number; description?: string; customerId?: string }[] = [
    ...rr.lines.map((l) => ({ accountNumber: l.accountNumber, debit: lineAmount(l), credit: 0, description: l.description, customerId: cust.id })),
  ];
  if (tax > 0) lines.push({ accountNumber: ACCT.vatPayable, debit: tax, credit: 0, description: `VAT reversed — ${rr.number}`, customerId: cust.id });
  lines.push({ accountNumber: rr.fromAccountNumber, debit: 0, credit: total, description: `Refund to ${cust.name}` });
  return useLedger.getState().postJournal({ date: rr.date, source: "Refund Receipt", memo: `Refund ${rr.number} — ${cust.name}`, reference: rr.number, lines });
}

function postCreditNoteJE(cn: CreditNote, cust: Customer) {
  const led = useLedger.getState();
  const total = docTotal(cn.lines);
  const tax = docTax(cn.lines);
  const lines = [
    ...cn.lines.map((l) => ({ accountNumber: l.accountNumber, debit: lineAmount(l), credit: 0, description: l.description, customerId: cust.id })),
  ];
  if (tax > 0) lines.push({ accountNumber: ACCT.vatPayable, debit: tax, credit: 0, description: `VAT adjustment — ${cn.number}`, customerId: cust.id });
  lines.push({ accountNumber: cust.arAccountNumber, debit: 0, credit: total, description: `${cn.number} — ${cust.name}`, customerId: cust.id });
  return led.postJournal({ date: cn.date, source: "Credit Note", memo: `Credit note ${cn.number} — ${cust.name}`, reference: cn.number, lines });
}

const recomputeStatus = (inv: Invoice): Invoice["status"] => {
  if (inv.status === "Draft" || inv.status === "Void") return inv.status;
  const total = docTotal(inv.lines);
  if (inv.amountPaid >= total - 0.01) return "Paid";
  if (new Date(inv.dueDate).getTime() < Date.now()) return "Overdue";
  if (inv.amountPaid > 0.01) return "Partially Paid";
  return "Open";
};

type ARState = {
  customers: Customer[];
  estimates: Estimate[];
  salesOrders: SalesOrder[];
  invoices: Invoice[];
  receipts: CustomerReceipt[];
  creditNotes: CreditNote[];
  revenueSchedules: RevenueSchedule[];
  reminders: InvoiceReminder[];
  salesReceipts: SalesReceipt[];
  refundReceipts: RefundReceipt[];
  delayedCharges: DelayedCharge[];
  statementLog: { customerId: string; to: string; sentAt: string; by: string }[];

  // customers
  addCustomer: (c: Omit<Customer, "id" | "createdAt" | "arAccountNumber" | "creditHold" | "openingBalance"> & { openingBalance?: number }) => string;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  customerById: (id?: string) => Customer | undefined;
  /** B16 — bulk import customers from parsed CSV rows: {name,type?,email?,phone?,city?,credit_limit?,opening_balance?} */
  importCustomers: (rows: Record<string, string>[]) => { added: number; errors: string[] };

  // estimates
  createEstimate: (input: { customerId: string; date: string; expiryDays: number; lines: SalesLine[]; notes?: string }) => string;
  updateEstimate: (id: string, patch: Partial<Pick<Estimate, "date" | "expiryDate" | "lines" | "notes">>) => void;
  setEstimateStatus: (id: string, status: Estimate["status"]) => void;
  convertEstimateToOrder: (id: string) => string | undefined;
  convertEstimateToInvoice: (id: string) => string | undefined;

  // sales orders
  createSalesOrder: (input: { customerId: string; date: string; lines: SalesLine[]; notes?: string; estimateId?: string }) => string;
  confirmSalesOrder: (id: string) => void;
  cancelSalesOrder: (id: string) => void;
  convertOrderToInvoice: (id: string) => string | undefined;

  // invoices
  createInvoice: (input: { customerId: string; date: string; dueDate?: string; lines: SalesLine[]; notes?: string; salesOrderId?: string; source?: Invoice["source"]; emrInvoiceId?: string; currency?: string; exchangeRate?: number; deferOverMonths?: number; recurEveryMonths?: number; recurEndDate?: string; delayedChargeIds?: string[]; projectId?: string; timeEntryIds?: string[] }) => string;
  updateInvoice: (id: string, patch: Partial<Pick<Invoice, "date" | "dueDate" | "lines" | "notes">>) => void;
  issueInvoice: (id: string, opts?: { overrideCredit?: boolean }) => { ok: boolean; error?: string; creditWarning?: string };
  voidInvoice: (id: string) => { ok: boolean; error?: string };
  /** B5 — returns a blocking reason if this customer can't take `addAmount` more of AR */
  creditCheck: (customerId: string, addAmount: number) => { blocked: boolean; reason?: string };

  // receipts
  recordReceipt: (input: { customerId: string; date: string; method: CustomerReceipt["method"]; depositAccountNumber: number; amount: number; allocations: ReceiptAllocation[]; settlementRate?: number; reference?: string; notes?: string }) => { ok: boolean; error?: string };
  /** B4 — early-payment discount available on this invoice if paid on `date` */
  earlyPayDiscountFor: (inv: Invoice, date: string) => number;

  // multi-currency / recurring / revenue recognition
  revalueForeignAr: (asOf: string, rates: Record<string, number>) => { module: string; adjusted: number; net: number };
  runRecurringInvoices: (asOf: string) => { created: string[] };
  recognizeRevenue: (scheduleId: string, period: string) => { ok: boolean; error?: string };
  revenueScheduleFor: (invoiceId: string) => RevenueSchedule | undefined;

  // dunning
  reminderDue: (inv: Invoice) => { level: number; tone: string } | undefined;
  sendReminder: (invoiceId: string) => { ok: boolean; level?: number };
  runReminderRun: () => { sent: number };

  // credit notes
  createCreditNote: (input: { customerId: string; invoiceId?: string; date: string; lines: SalesLine[]; reason: string; notes?: string }) => string;
  applyCreditNote: (cnId: string, invoiceId: string, amount: number) => void;
  refundCreditNote: (cnId: string, amount: number, fromAccountNumber: number) => void;

  // B1 sales receipts (cash sale, no invoice)
  createSalesReceipt: (input: { customerId?: string; customerName?: string; date: string; method: SalesReceipt["method"]; depositAccountNumber: number; lines: SalesLine[]; notes?: string }) => { ok: boolean; error?: string; id?: string };
  voidSalesReceipt: (id: string) => { ok: boolean; error?: string };

  // B2 refund receipts
  createRefundReceipt: (input: { customerId: string; date: string; method: RefundReceipt["method"]; fromAccountNumber: number; lines: SalesLine[]; reason: string; notes?: string }) => { ok: boolean; error?: string; id?: string };
  voidRefundReceipt: (id: string) => { ok: boolean; error?: string };

  // B3 delayed charges
  addDelayedCharge: (input: { customerId: string; date: string; accountNumber: number; description: string; qty: number; unitPrice: number; taxRateId?: string }) => void;
  removeDelayedCharge: (id: string) => void;
  unbilledChargesOf: (customerId: string) => DelayedCharge[];

  // B7 statement delivery
  markStatementSent: (customerId: string) => { ok: boolean; to?: string };
  lastStatementSent: (customerId: string) => string | undefined;

  // selectors
  invoicesOf: (customerId: string) => Invoice[];
  openInvoicesOf: (customerId: string) => Invoice[];
  invoiceBalance: (inv: Invoice) => number; // in the invoice's own currency
  customerBalance: (customerId: string) => number; // NGN
  agingFor: (asOf: string) => { customer: Customer; current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number; total: number }[];
};

export const useAR = create<ARState>((set, get) => {
  // ---- hydrate: post journal entries for the seeded, already-issued documents ----
  const customers = seedCustomers;
  const custOf = (id: string) => customers.find((c) => c.id === id)!;

  const invoices = seedInvoices.map((inv) => {
    if (inv.status === "Draft" || inv.status === "Void" || inv.journalEntryId) return inv;
    const je = postInvoiceJE(inv, custOf(inv.customerId));
    return { ...inv, journalEntryId: je.entry?.id, status: recomputeStatus(inv) };
  });
  const invById = (id: string) => invoices.find((i) => i.id === id);
  const receipts = seedReceipts.map((r) => {
    if (r.journalEntryId) return r;
    const je = postReceiptJE(r, custOf(r.customerId), invById);
    return { ...r, journalEntryId: je.entry?.id };
  });
  const salesReceipts = seedSalesReceipts.map((sr) => {
    if (sr.journalEntryId || sr.status === "Void") return sr;
    const je = postSalesReceiptJE(sr, sr.customerName ?? custOf(sr.customerId ?? "")?.name ?? "Cash customer");
    return { ...sr, journalEntryId: je.entry?.id };
  });

  return {
    customers,
    estimates: seedEstimates,
    salesOrders: seedSalesOrders,
    invoices,
    receipts,
    creditNotes: seedCreditNotes,
    revenueSchedules: seedRevenueSchedules,
    reminders: seedReminders,
    salesReceipts,
    refundReceipts: seedRefundReceipts,
    delayedCharges: seedDelayedCharges,
    statementLog: [],

    addCustomer: (c) => {
      const id = `cust-${rid()}`;
      const customer: Customer = {
        ...c,
        id,
        arAccountNumber: arAccountForType(c.type),
        creditHold: false,
        openingBalance: c.openingBalance ?? 0,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ customers: [customer, ...s.customers] }));
      audit(`added customer ${c.name}`, `accounting/customers/${c.name}`);
      if (customer.openingBalance > 0) {
        useLedger.getState().postJournal({
          date: useLedger.getState().booksLockedBefore ?? new Date().toISOString(),
          source: "Opening Balance",
          memo: `Opening AR balance — ${c.name}`,
          lines: [
            { accountNumber: customer.arAccountNumber, debit: customer.openingBalance, credit: 0, customerId: id },
            { accountNumber: ACCT.openingBalanceEquity, debit: 0, credit: customer.openingBalance },
          ],
        });
      }
      return id;
    },
    updateCustomer: (id, patch) => {
      set((s) => ({ customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
      audit(`updated customer`, `accounting/customers/${id}`);
    },
    customerById: (id) => get().customers.find((c) => c.id === id),

    importCustomers: (rows) => {
      const types = ["Patient", "NHIS", "HMO", "Corporate", "Walk-in"];
      let added = 0;
      const errors: string[] = [];
      for (const [i, r] of rows.entries()) {
        const name = (r.name ?? "").trim();
        if (!name) { errors.push(`Row ${i + 2}: missing name`); continue; }
        const type = (types.find((t) => t.toLowerCase() === (r.type ?? "").toLowerCase()) ?? "Corporate") as CustomerType;
        get().addCustomer({
          name, type,
          email: r.email || undefined, phone: r.phone || undefined, city: r.city || undefined,
          paymentTermsDays: Number(r.payment_terms_days ?? r["payment terms"] ?? 30) || 30,
          creditLimit: Number(r.credit_limit ?? r["credit limit"] ?? 0) || 0,
          openingBalance: Number(r.opening_balance ?? r["opening balance"] ?? 0) || 0,
        });
        added++;
      }
      audit(`imported ${added} customer(s) from CSV`, "accounting/customers/import");
      return { added, errors };
    },

    createEstimate: (input) => {
      const id = `est-${rid()}`;
      const est: Estimate = {
        id,
        number: useAccountingSettings.getState().nextDocNumber("estimate"),
        customerId: input.customerId,
        date: input.date,
        expiryDate: daysAdd(input.date, input.expiryDays),
        lines: input.lines,
        notes: input.notes,
        status: "Draft",
        createdBy: useIdentity.getState().user.id,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ estimates: [est, ...s.estimates] }));
      audit(`created estimate ${est.number}`, `accounting/estimates/${est.number}`);
      return id;
    },
    updateEstimate: (id, patch) => set((s) => ({ estimates: s.estimates.map((e) => (e.id === id && e.status === "Draft" ? { ...e, ...patch } : e)) })),
    setEstimateStatus: (id, status) => {
      set((s) => ({ estimates: s.estimates.map((e) => (e.id === id ? { ...e, status } : e)) }));
      audit(`marked estimate ${status.toLowerCase()}`, `accounting/estimates/${id}`);
    },
    convertEstimateToOrder: (id) => {
      const e = get().estimates.find((x) => x.id === id);
      if (!e) return;
      const soId = get().createSalesOrder({ customerId: e.customerId, date: new Date().toISOString(), lines: e.lines, notes: e.notes, estimateId: e.id });
      set((s) => ({ estimates: s.estimates.map((x) => (x.id === id ? { ...x, status: "Converted", convertedToOrderId: soId } : x)) }));
      return soId;
    },
    convertEstimateToInvoice: (id) => {
      const e = get().estimates.find((x) => x.id === id);
      if (!e) return;
      const invId = get().createInvoice({ customerId: e.customerId, date: new Date().toISOString(), lines: e.lines, notes: e.notes });
      set((s) => ({ estimates: s.estimates.map((x) => (x.id === id ? { ...x, status: "Converted", convertedToInvoiceId: invId } : x)) }));
      return invId;
    },

    createSalesOrder: (input) => {
      const id = `so-${rid()}`;
      const so: SalesOrder = {
        id,
        number: useAccountingSettings.getState().nextDocNumber("sales-order"),
        customerId: input.customerId,
        estimateId: input.estimateId,
        date: input.date,
        lines: input.lines,
        notes: input.notes,
        status: "Draft",
        createdBy: useIdentity.getState().user.id,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ salesOrders: [so, ...s.salesOrders] }));
      audit(`created sales order ${so.number}`, `accounting/sales-orders/${so.number}`);
      return id;
    },
    confirmSalesOrder: (id) => {
      set((s) => ({ salesOrders: s.salesOrders.map((o) => (o.id === id ? { ...o, status: "Confirmed" } : o)) }));
      audit(`confirmed sales order`, `accounting/sales-orders/${id}`);
    },
    cancelSalesOrder: (id) => set((s) => ({ salesOrders: s.salesOrders.map((o) => (o.id === id ? { ...o, status: "Cancelled" } : o)) })),
    convertOrderToInvoice: (id) => {
      const o = get().salesOrders.find((x) => x.id === id);
      if (!o) return;
      const invId = get().createInvoice({ customerId: o.customerId, date: new Date().toISOString(), lines: o.lines, notes: o.notes, salesOrderId: o.id });
      set((s) => ({ salesOrders: s.salesOrders.map((x) => (x.id === id ? { ...x, status: "Converted", invoiceId: invId } : x)) }));
      return invId;
    },

    createInvoice: (input) => {
      const id = `inv-${rid()}`;
      const cust = get().customerById(input.customerId);
      const currency = input.currency ?? cust?.currency ?? "NGN";
      const rate = currency === "NGN" ? 1 : input.exchangeRate ?? (useLedger.getState().fxRates.find((r) => r.code === currency)?.rateToNgn ?? 1);
      const pulledCharges = (input.delayedChargeIds ?? [])
        .map((cid) => get().delayedCharges.find((d) => d.id === cid && d.status === "Unbilled"))
        .filter((d): d is DelayedCharge => !!d);
      const chargeLines: SalesLine[] = pulledCharges.map((d) => ({ id: `sl-${rid()}`, accountNumber: d.accountNumber, description: d.description, qty: d.qty, unitPrice: d.unitPrice, taxRateId: d.taxRateId }));
      const timeLines: SalesLine[] = (input.timeEntryIds ?? [])
        .map((tid) => useProjects.getState().timeEntries.find((t) => t.id === tid && t.status === "Unbilled"))
        .filter((t): t is NonNullable<typeof t> => !!t)
        .map((t) => ({ id: `sl-${rid()}`, accountNumber: t.revenueAccount, description: `${t.description} (${t.hours}h)`, qty: t.hours, unitPrice: t.rate ?? 0, taxRateId: "tax-vat-exempt" }));
      const allLines = [...input.lines, ...chargeLines, ...timeLines];
      const inv: Invoice = {
        id,
        number: useAccountingSettings.getState().nextDocNumber("invoice"),
        customerId: input.customerId,
        salesOrderId: input.salesOrderId,
        date: input.date,
        dueDate: input.dueDate ?? useAccountingSettings.getState().dueDateFor(input.date, cust?.paymentTermId, cust?.paymentTermsDays ?? 30),
        lines: allLines,
        notes: input.notes,
        status: "Draft",
        amountPaid: 0,
        currency,
        exchangeRate: rate,
        createdBy: useIdentity.getState().user.id,
        createdAt: new Date().toISOString(),
        source: input.source ?? "Manual",
        emrInvoiceId: input.emrInvoiceId,
        projectId: input.projectId,
        ...(input.recurEveryMonths ? { isRecurring: true, recurringTemplate: false, recurrenceEveryMonths: input.recurEveryMonths, recurrenceNextDate: monthsAdd(input.date, input.recurEveryMonths), recurrenceEndDate: input.recurEndDate } : {}),
      };
      set((s) => ({
        invoices: [inv, ...s.invoices],
        delayedCharges: pulledCharges.length
          ? s.delayedCharges.map((d) => (pulledCharges.some((p) => p.id === d.id) ? { ...d, status: "Invoiced" as const, invoiceId: id } : d))
          : s.delayedCharges,
      }));
      if (input.timeEntryIds?.length) useProjects.getState().markTimeInvoiced(input.timeEntryIds, id);
      audit(`created invoice ${inv.number}`, `accounting/invoices/${inv.number}`);

      const defer = input.deferOverMonths ?? 0;
      if (defer > 1) {
        const net = round2(docSubtotal(allLines) * rate);
        const per = round2(net / defer);
        const revAcct = allLines[0]?.accountNumber ?? ACCT.consultationRevenue;
        const entries = Array.from({ length: defer }, (_, i) => ({
          id: `rse-${rid()}`,
          period: ym(monthsAdd(input.date, i)),
          amount: i === defer - 1 ? round2(net - per * (defer - 1)) : per,
          recognized: false,
        }));
        const sch: RevenueSchedule = { id: `rsch-${rid()}`, invoiceId: id, customerId: input.customerId, totalAmount: net, method: "Straight Line", startPeriod: ym(input.date), months: defer, deferredAccountNumber: ACCT.deferredRevenue, revenueAccountNumber: revAcct, entries, createdAt: new Date().toISOString() };
        set((s) => ({ revenueSchedules: [sch, ...s.revenueSchedules], invoices: s.invoices.map((x) => (x.id === id ? { ...x, revenueScheduleId: sch.id } : x)) }));
      }
      return id;
    },
    updateInvoice: (id, patch) => set((s) => ({ invoices: s.invoices.map((i) => (i.id === id && i.status === "Draft" ? { ...i, ...patch } : i)) })),

    creditCheck: (customerId, addAmount) => {
      const cust = get().customerById(customerId);
      if (!cust) return { blocked: false };
      if (cust.creditHold) return { blocked: true, reason: `${cust.name} is on credit hold. Release the hold before issuing.` };
      if (cust.creditLimit > 0) {
        const projected = round2(get().customerBalance(customerId) + addAmount);
        if (projected > cust.creditLimit) return { blocked: true, reason: `Issuing this would put ${cust.name} at ${projected.toLocaleString()} against a ${cust.creditLimit.toLocaleString()} limit.` };
      }
      return { blocked: false };
    },

    issueInvoice: (id, opts) => {
      const inv = get().invoices.find((i) => i.id === id);
      if (!inv || inv.status !== "Draft") return { ok: false, error: "Only a draft invoice can be issued." };
      const cust = get().customerById(inv.customerId);
      if (!cust) return { ok: false, error: "Customer not found." };
      if (!inv.lines.length || docTotal(inv.lines) <= 0) return { ok: false, error: "Add at least one line with an amount." };
      const credit = get().creditCheck(inv.customerId, invoiceBalanceNgn(inv));
      if (credit.blocked && !opts?.overrideCredit) return { ok: false, error: credit.reason };
      const schedule = inv.revenueScheduleId ? get().revenueSchedules.find((x) => x.id === inv.revenueScheduleId) : undefined;
      const je = postInvoiceJE(inv, cust, schedule);
      if (!je.ok) return { ok: false, error: je.error };
      set((s) => ({
        invoices: s.invoices.map((i) => (i.id === id ? { ...i, status: recomputeStatus({ ...i, status: "Open" }), journalEntryId: je.entry?.id, issuedAt: new Date().toISOString() } : i)),
      }));
      audit(`issued invoice ${inv.number}${credit.blocked ? " (credit limit overridden)" : ""}`, `accounting/invoices/${inv.number}`);
      return { ok: true, creditWarning: credit.blocked ? credit.reason : undefined };
    },

    voidInvoice: (id) => {
      const inv = get().invoices.find((i) => i.id === id);
      if (!inv) return { ok: false, error: "Not found." };
      if (inv.amountPaid > 0) return { ok: false, error: "Un-apply receipts and credit notes before voiding." };
      if (inv.journalEntryId) {
        const r = useLedger.getState().reverseEntry(inv.journalEntryId, { memo: `Void invoice ${inv.number}` });
        if (!r.ok) return { ok: false, error: r.error };
      }
      set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? { ...i, status: "Void" } : i)) }));
      audit(`voided invoice ${inv.number}`, `accounting/invoices/${inv.number}`);
      return { ok: true };
    },

    recordReceipt: (input) => {
      const cust = get().customerById(input.customerId);
      if (!cust) return { ok: false, error: "Customer not found." };
      const id = `rcpt-${rid()}`;
      const receipt: CustomerReceipt = {
        id,
        number: useAccountingSettings.getState().nextDocNumber("receipt"),
        customerId: input.customerId,
        date: input.date,
        method: input.method,
        depositAccountNumber: input.depositAccountNumber,
        amount: input.amount,
        allocations: input.allocations.filter((a) => a.amount > 0),
        settlementRate: input.settlementRate,
        reference: input.reference,
        notes: input.notes,
        createdBy: useIdentity.getState().user.id,
        createdAt: new Date().toISOString(),
      };
      const je = postReceiptJE(receipt, cust, (iid) => get().invoices.find((i) => i.id === iid));
      if (!je.ok) return { ok: false, error: je.error };
      receipt.journalEntryId = je.entry?.id;
      set((s) => ({
        receipts: [receipt, ...s.receipts],
        invoices: s.invoices.map((i) => {
          const a = receipt.allocations.find((x) => x.invoiceId === i.id);
          if (!a) return i;
          const paid = round2(i.amountPaid + a.amount + (a.discount ?? 0));
          return { ...i, amountPaid: paid, status: recomputeStatus({ ...i, amountPaid: paid }) };
        }),
      }));
      audit(`recorded receipt ${receipt.number} — ${cust.name}`, `accounting/receipts/${receipt.number}`);
      return { ok: true };
    },

    earlyPayDiscountFor: (inv, date) => {
      const cust = get().customerById(inv.customerId);
      const term = useAccountingSettings.getState().termById(cust?.paymentTermId);
      if (!term?.discountPercent || !term.discountDays) return 0;
      const cutoff = new Date(inv.date).getTime() + term.discountDays * 864e5;
      if (new Date(date).getTime() > cutoff) return 0;
      return round2((docTotal(inv.lines) - inv.amountPaid) * (term.discountPercent / 100));
    },

    createCreditNote: (input) => {
      const cust = get().customerById(input.customerId)!;
      const id = `cn-${rid()}`;
      const cn: CreditNote = {
        id,
        number: useAccountingSettings.getState().nextDocNumber("credit-note"),
        customerId: input.customerId,
        invoiceId: input.invoiceId,
        date: input.date,
        lines: input.lines,
        reason: input.reason,
        notes: input.notes,
        status: "Open",
        applications: [],
        refundedAmount: 0,
        createdBy: useIdentity.getState().user.id,
        createdAt: new Date().toISOString(),
      };
      const je = postCreditNoteJE(cn, cust);
      cn.journalEntryId = je.entry?.id;
      set((s) => ({ creditNotes: [cn, ...s.creditNotes] }));
      audit(`issued credit note ${cn.number} — ${cust.name}`, `accounting/credit-notes/${cn.number}`);
      return id;
    },

    applyCreditNote: (cnId, invoiceId, amount) => {
      const amt = round2(amount);
      set((s) => ({
        creditNotes: s.creditNotes.map((cn) => {
          if (cn.id !== cnId) return cn;
          const apps = [...cn.applications, { invoiceId, amount: amt, date: new Date().toISOString() }];
          const used = round2(apps.reduce((n, a) => n + a.amount, 0) + cn.refundedAmount);
          const total = docTotal(cn.lines);
          return { ...cn, applications: apps, status: used >= total - 0.01 ? "Applied" : "Partially Applied" };
        }),
        invoices: s.invoices.map((i) => {
          if (i.id !== invoiceId) return i;
          const paid = round2(i.amountPaid + amt);
          return { ...i, amountPaid: paid, status: recomputeStatus({ ...i, amountPaid: paid }) };
        }),
      }));
      audit(`applied credit note to invoice`, `accounting/credit-notes/${cnId}`);
    },

    refundCreditNote: (cnId, amount, fromAccountNumber) => {
      const cn = get().creditNotes.find((x) => x.id === cnId);
      if (!cn) return;
      const cust = get().customerById(cn.customerId)!;
      const amt = round2(amount);
      useLedger.getState().postJournal({
        date: new Date().toISOString(),
        source: "Credit Note",
        memo: `Refund on credit note ${cn.number} — ${cust.name}`,
        reference: cn.number,
        lines: [
          { accountNumber: cust.arAccountNumber, debit: amt, credit: 0, description: "Reverse customer credit", customerId: cust.id },
          { accountNumber: fromAccountNumber, debit: 0, credit: amt, description: `Refund to ${cust.name}` },
        ],
      });
      set((s) => ({
        creditNotes: s.creditNotes.map((x) => {
          if (x.id !== cnId) return x;
          const refunded = round2(x.refundedAmount + amt);
          const used = round2(x.applications.reduce((n, a) => n + a.amount, 0) + refunded);
          return { ...x, refundedAmount: refunded, status: used >= docTotal(x.lines) - 0.01 ? "Refunded" : x.status };
        }),
      }));
      audit(`refunded credit note ${cn.number}`, `accounting/credit-notes/${cn.number}`);
    },

    createSalesReceipt: (input) => {
      if (!input.lines.length || docTotal(input.lines) <= 0) return { ok: false, error: "Add at least one line with an amount." };
      const who = input.customerName || get().customerById(input.customerId)?.name || "Cash customer";
      const id = `srct-${rid()}`;
      const sr: SalesReceipt = {
        id,
        number: useAccountingSettings.getState().nextDocNumber("sales-receipt"),
        customerId: input.customerId,
        customerName: input.customerId ? undefined : input.customerName,
        date: input.date,
        method: input.method,
        depositAccountNumber: input.depositAccountNumber,
        lines: input.lines,
        notes: input.notes,
        status: "Completed",
        createdBy: useIdentity.getState().user.id,
        createdAt: new Date().toISOString(),
      };
      const je = postSalesReceiptJE(sr, who);
      if (!je.ok) return { ok: false, error: je.error };
      sr.journalEntryId = je.entry?.id;
      set((s) => ({ salesReceipts: [sr, ...s.salesReceipts] }));
      audit(`recorded sales receipt ${sr.number} — ${who}`, `accounting/sales-receipts/${sr.number}`);
      return { ok: true, id };
    },
    voidSalesReceipt: (id) => {
      const sr = get().salesReceipts.find((x) => x.id === id);
      if (!sr || sr.status === "Void") return { ok: false, error: "Not found." };
      if (sr.journalEntryId) {
        const r = useLedger.getState().reverseEntry(sr.journalEntryId, { memo: `Void sales receipt ${sr.number}` });
        if (!r.ok) return { ok: false, error: r.error };
      }
      set((s) => ({ salesReceipts: s.salesReceipts.map((x) => (x.id === id ? { ...x, status: "Void" } : x)) }));
      audit(`voided sales receipt ${sr.number}`, `accounting/sales-receipts/${sr.number}`);
      return { ok: true };
    },

    createRefundReceipt: (input) => {
      const cust = get().customerById(input.customerId);
      if (!cust) return { ok: false, error: "Customer not found." };
      if (!input.lines.length || docTotal(input.lines) <= 0) return { ok: false, error: "Add at least one line with an amount." };
      const id = `rfnd-${rid()}`;
      const rr: RefundReceipt = {
        id,
        number: useAccountingSettings.getState().nextDocNumber("refund-receipt"),
        customerId: input.customerId,
        date: input.date,
        method: input.method,
        fromAccountNumber: input.fromAccountNumber,
        lines: input.lines,
        reason: input.reason,
        notes: input.notes,
        status: "Completed",
        createdBy: useIdentity.getState().user.id,
        createdAt: new Date().toISOString(),
      };
      const je = postRefundReceiptJE(rr, cust);
      if (!je.ok) return { ok: false, error: je.error };
      rr.journalEntryId = je.entry?.id;
      set((s) => ({ refundReceipts: [rr, ...s.refundReceipts] }));
      audit(`issued refund receipt ${rr.number} — ${cust.name}`, `accounting/refund-receipts/${rr.number}`);
      return { ok: true, id };
    },
    voidRefundReceipt: (id) => {
      const rr = get().refundReceipts.find((x) => x.id === id);
      if (!rr || rr.status === "Void") return { ok: false, error: "Not found." };
      if (rr.journalEntryId) {
        const r = useLedger.getState().reverseEntry(rr.journalEntryId, { memo: `Void refund receipt ${rr.number}` });
        if (!r.ok) return { ok: false, error: r.error };
      }
      set((s) => ({ refundReceipts: s.refundReceipts.map((x) => (x.id === id ? { ...x, status: "Void" } : x)) }));
      audit(`voided refund receipt ${rr.number}`, `accounting/refund-receipts/${rr.number}`);
      return { ok: true };
    },

    addDelayedCharge: (input) => {
      const dc: DelayedCharge = { id: `dc-${rid()}`, ...input, status: "Unbilled", createdBy: useIdentity.getState().user.id, createdAt: new Date().toISOString() };
      set((s) => ({ delayedCharges: [dc, ...s.delayedCharges] }));
      audit(`added delayed charge — ${input.description}`, `accounting/delayed-charges`);
    },
    removeDelayedCharge: (id) => set((s) => ({ delayedCharges: s.delayedCharges.filter((d) => d.id !== id || d.status === "Invoiced") })),
    unbilledChargesOf: (customerId) => get().delayedCharges.filter((d) => d.customerId === customerId && d.status === "Unbilled"),

    revalueForeignAr: (asOf, rates) => {
      const led = useLedger.getState();
      const open = get().invoices.filter((i) => i.currency !== "NGN" && (i.status === "Open" || i.status === "Partially Paid" || i.status === "Overdue"));
      let adjusted = 0;
      let net = 0;
      for (const inv of open) {
        const newRate = rates[inv.currency];
        if (!newRate || Math.abs(newRate - fxOf(inv)) < 0.005) continue;
        const balForeign = round2(docTotal(inv.lines) - inv.amountPaid);
        const delta = round2(balForeign * (newRate - fxOf(inv)));
        if (Math.abs(delta) < 0.005) continue;
        const cust = get().customerById(inv.customerId)!;
        led.postJournal({
          date: asOf,
          source: "FX Revaluation",
          memo: `FX revaluation — ${inv.number} (${inv.currency} ${fxOf(inv)} → ${newRate})`,
          reference: inv.number,
          lines: delta > 0
            ? [{ accountNumber: cust.arAccountNumber, debit: delta, credit: 0, customerId: cust.id }, { accountNumber: ACCT.fxGain, debit: 0, credit: delta, description: "Unrealised FX gain" }]
            : [{ accountNumber: ACCT.fxLoss, debit: -delta, credit: 0, description: "Unrealised FX loss" }, { accountNumber: cust.arAccountNumber, debit: 0, credit: -delta, customerId: cust.id }],
        });
        set((s) => ({ invoices: s.invoices.map((x) => (x.id === inv.id ? { ...x, exchangeRate: newRate } : x)) }));
        adjusted++;
        net = round2(net + delta);
      }
      audit(`revalued ${adjusted} foreign AR balance(s) — net ${net.toLocaleString()}`, "accounting/fx/revaluation");
      return { module: "AR", adjusted, net };
    },

    runRecurringInvoices: (asOf) => {
      const t = new Date(asOf).getTime();
      const created: string[] = [];
      for (const src of get().invoices.filter((i) => i.isRecurring && i.recurrenceNextDate && new Date(i.recurrenceNextDate).getTime() <= t)) {
        if (src.recurrenceEndDate && new Date(src.recurrenceNextDate!).getTime() > new Date(src.recurrenceEndDate).getTime()) continue;
        const newId = get().createInvoice({ customerId: src.customerId, date: src.recurrenceNextDate!, lines: src.lines, notes: `Recurring from ${src.number}`, currency: src.currency, exchangeRate: src.exchangeRate });
        get().issueInvoice(newId);
        created.push(newId);
        set((s) => ({ invoices: s.invoices.map((x) => (x.id === src.id ? { ...x, recurrenceNextDate: monthsAdd(x.recurrenceNextDate!, x.recurrenceEveryMonths ?? 1) } : x)) }));
      }
      if (created.length) audit(`generated ${created.length} recurring invoice(s)`, "accounting/invoices/recurring");
      return { created };
    },

    recognizeRevenue: (scheduleId, period) => {
      const sch = get().revenueSchedules.find((x) => x.id === scheduleId);
      if (!sch) return { ok: false, error: "Schedule not found." };
      const entry = sch.entries.find((e) => e.period === period && !e.recognized);
      if (!entry) return { ok: false, error: "Nothing to recognise for that period." };
      const cust = get().customerById(sch.customerId)!;
      const [py, pm] = period.split("-").map(Number);
      const periodEnd = new Date(Date.UTC(py, pm, 0, 12)).getTime();
      const je = useLedger.getState().postJournal({
        date: new Date(Math.min(periodEnd, Date.now())).toISOString(),
        source: "Manual",
        memo: `Revenue recognised — ${period} (sched ${sch.id.slice(-4)})`,
        reference: sch.invoiceId,
        lines: [
          { accountNumber: sch.deferredAccountNumber, debit: entry.amount, credit: 0, description: "Release deferred revenue", customerId: cust.id },
          { accountNumber: sch.revenueAccountNumber, debit: 0, credit: entry.amount, description: `Recognised revenue — ${period}`, customerId: cust.id },
        ],
      });
      if (!je.ok) return { ok: false, error: je.error };
      set((s) => ({ revenueSchedules: s.revenueSchedules.map((x) => (x.id === scheduleId ? { ...x, entries: x.entries.map((e) => (e === entry ? { ...e, recognized: true, recognizedAt: new Date().toISOString(), journalEntryId: je.entry?.id } : e)) } : x)) }));
      audit(`recognised revenue for ${period}`, `accounting/revenue-schedules/${scheduleId}`);
      return { ok: true };
    },

    revenueScheduleFor: (invoiceId) => get().revenueSchedules.find((x) => x.invoiceId === invoiceId),

    reminderDue: (inv) => {
      if (!(inv.status === "Overdue" || inv.status === "Partially Paid")) return undefined;
      const overdueDays = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 864e5);
      if (overdueDays <= 0) return undefined;
      const alreadySent = get().reminders.filter((r) => r.invoiceId === inv.id).reduce((mx, r) => Math.max(mx, r.level), 0);
      const rules = useAccountingSettings.getState().reminderRules.filter((r) => r.active);
      const eligible = rules.filter((l) => l.daysOverdue <= overdueDays && l.level > alreadySent).sort((a, b) => b.level - a.level)[0];
      return eligible ? { level: eligible.level, tone: eligible.tone } : undefined;
    },

    sendReminder: (invoiceId) => {
      const inv = get().invoices.find((i) => i.id === invoiceId);
      if (!inv) return { ok: false };
      const due = get().reminderDue(inv);
      if (!due) return { ok: false };
      const cust = get().customerById(inv.customerId);
      set((s) => ({ reminders: [{ invoiceId, level: due.level, tone: due.tone, sentAt: new Date().toISOString(), sentBy: useIdentity.getState().user.id }, ...s.reminders] }));
      audit(`sent ${due.tone.toLowerCase()} payment reminder — ${inv.number} to ${cust?.name}`, `accounting/invoices/${inv.number}`);
      return { ok: true, level: due.level };
    },

    runReminderRun: () => {
      let sent = 0;
      for (const inv of get().invoices) {
        const r = get().sendReminder(inv.id);
        if (r.ok) sent++;
      }
      return { sent };
    },

    markStatementSent: (customerId) => {
      const cust = get().customerById(customerId);
      if (!cust?.email) return { ok: false };
      set((s) => ({ statementLog: [{ customerId, to: cust.email!, sentAt: new Date().toISOString(), by: useIdentity.getState().user.id }, ...s.statementLog] }));
      audit(`sent statement of account to ${cust.name} (${cust.email})`, `accounting/customers/${cust.name}`);
      return { ok: true, to: cust.email };
    },
    lastStatementSent: (customerId) => get().statementLog.find((l) => l.customerId === customerId)?.sentAt,

    invoicesOf: (customerId) => get().invoices.filter((i) => i.customerId === customerId),
    openInvoicesOf: (customerId) => get().invoices.filter((i) => i.customerId === customerId && (i.status === "Open" || i.status === "Partially Paid" || i.status === "Overdue")),
    invoiceBalance: (inv) => round2(docTotal(inv.lines) - inv.amountPaid),
    customerBalance: (customerId) => {
      const cust = get().customerById(customerId);
      if (!cust) return 0;
      const open = get().invoices.filter((i) => i.customerId === customerId && i.status !== "Draft" && i.status !== "Void");
      const invBal = open.reduce((n, i) => n + invoiceBalanceNgn(i), 0);
      return round2(invBal);
    },
    agingFor: (asOf) => {
      const now = new Date(asOf).getTime();
      return get().customers.map((customer) => {
        const bucket = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
        get()
          .invoices.filter((i) => i.customerId === customer.id && (i.status === "Open" || i.status === "Partially Paid" || i.status === "Overdue"))
          .forEach((i) => {
            const bal = invoiceBalanceNgn(i);
            const overdueDays = Math.floor((now - new Date(i.dueDate).getTime()) / 864e5);
            if (overdueDays <= 0) bucket.current += bal;
            else if (overdueDays <= 30) bucket.d1_30 += bal;
            else if (overdueDays <= 60) bucket.d31_60 += bal;
            else if (overdueDays <= 90) bucket.d61_90 += bal;
            else bucket.d90plus += bal;
          });
        const total = round2(bucket.current + bucket.d1_30 + bucket.d31_60 + bucket.d61_90 + bucket.d90plus);
        return { customer, ...bucket, total };
      });
    },
  };
});
