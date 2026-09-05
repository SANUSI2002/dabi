import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { useLedger } from "@/store/accounting/useLedger";
import { useTax } from "@/store/accounting/useTax";
import { ACCT } from "@/data/accounting/coa";
import {
  seedCustomers,
  seedInvoices,
  seedReceipts,
  seedEstimates,
  seedSalesOrders,
  seedCreditNotes,
  type Customer,
  type CustomerType,
  type SalesLine,
  type Estimate,
  type SalesOrder,
  type Invoice,
  type CustomerReceipt,
  type ReceiptAllocation,
  type CreditNote,
} from "@/data/accounting/receivables";

const rid = () => Math.random().toString(36).slice(2, 9);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const daysAdd = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 864e5).toISOString();

const lineAmount = (l: SalesLine) => round2(l.qty * l.unitPrice);
export const docSubtotal = (lines: SalesLine[]) => round2(lines.reduce((n, l) => n + lineAmount(l), 0));
export const docTax = (lines: SalesLine[]) => round2(lines.reduce((n, l) => n + useTax.getState().taxOn(lineAmount(l), l.taxRateId), 0));
export const docTotal = (lines: SalesLine[]) => round2(docSubtotal(lines) + docTax(lines));

const arAccountForType = (t: CustomerType) => (t === "NHIS" ? ACCT.arNhis : t === "HMO" ? ACCT.arHmo : ACCT.arPatients);

function postInvoiceJE(inv: Invoice, cust: Customer) {
  const led = useLedger.getState();
  const total = docTotal(inv.lines);
  const tax = docTax(inv.lines);
  const lines = [
    { accountNumber: cust.arAccountNumber, debit: total, credit: 0, description: `${inv.number} — ${cust.name}`, customerId: cust.id },
    ...inv.lines.map((l) => ({ accountNumber: l.accountNumber, debit: 0, credit: lineAmount(l), description: l.description, customerId: cust.id })),
  ];
  if (tax > 0) lines.push({ accountNumber: ACCT.vatPayable, debit: 0, credit: tax, description: `Output VAT — ${inv.number}`, customerId: cust.id });
  return led.postJournal({ date: inv.date, source: "Invoice", memo: `Invoice ${inv.number} — ${cust.name}`, reference: inv.number, lines });
}

function postReceiptJE(r: CustomerReceipt, cust: Customer) {
  return useLedger.getState().postJournal({
    date: r.date,
    source: "Customer Payment",
    memo: `Receipt ${r.number} — ${cust.name}`,
    reference: r.number,
    lines: [
      { accountNumber: r.depositAccountNumber, debit: r.amount, credit: 0, description: `${r.method} — ${cust.name}` },
      { accountNumber: cust.arAccountNumber, debit: 0, credit: r.amount, description: `Applied to ${r.allocations.map((a) => a.invoiceId).length} invoice(s)`, customerId: cust.id },
    ],
  });
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
  if (inv.amountPaid > 0.01) return "Partially Paid";
  if (new Date(inv.dueDate).getTime() < Date.now()) return "Overdue";
  return "Open";
};

type ARState = {
  customers: Customer[];
  estimates: Estimate[];
  salesOrders: SalesOrder[];
  invoices: Invoice[];
  receipts: CustomerReceipt[];
  creditNotes: CreditNote[];

  // customers
  addCustomer: (c: Omit<Customer, "id" | "createdAt" | "arAccountNumber" | "creditHold" | "openingBalance"> & { openingBalance?: number }) => string;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  customerById: (id?: string) => Customer | undefined;

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
  createInvoice: (input: { customerId: string; date: string; dueDate?: string; lines: SalesLine[]; notes?: string; salesOrderId?: string; source?: Invoice["source"]; emrInvoiceId?: string }) => string;
  updateInvoice: (id: string, patch: Partial<Pick<Invoice, "date" | "dueDate" | "lines" | "notes">>) => void;
  issueInvoice: (id: string) => { ok: boolean; error?: string };
  voidInvoice: (id: string) => { ok: boolean; error?: string };

  // receipts
  recordReceipt: (input: { customerId: string; date: string; method: CustomerReceipt["method"]; depositAccountNumber: number; amount: number; allocations: ReceiptAllocation[]; reference?: string; notes?: string }) => { ok: boolean; error?: string };

  // credit notes
  createCreditNote: (input: { customerId: string; invoiceId?: string; date: string; lines: SalesLine[]; reason: string; notes?: string }) => string;
  applyCreditNote: (cnId: string, invoiceId: string, amount: number) => void;
  refundCreditNote: (cnId: string, amount: number, fromAccountNumber: number) => void;

  // selectors
  invoicesOf: (customerId: string) => Invoice[];
  openInvoicesOf: (customerId: string) => Invoice[];
  invoiceBalance: (inv: Invoice) => number;
  customerBalance: (customerId: string) => number;
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
  const receipts = seedReceipts.map((r) => {
    if (r.journalEntryId) return r;
    const je = postReceiptJE(r, custOf(r.customerId));
    return { ...r, journalEntryId: je.entry?.id };
  });

  return {
    customers,
    estimates: seedEstimates,
    salesOrders: seedSalesOrders,
    invoices,
    receipts,
    creditNotes: seedCreditNotes,

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

    createEstimate: (input) => {
      const id = `est-${rid()}`;
      const n = get().estimates.length + 3001;
      const est: Estimate = {
        id,
        number: `EST-2026-${String(n).padStart(6, "0")}`,
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
      const n = get().salesOrders.length + 4001;
      const so: SalesOrder = {
        id,
        number: `SO-2026-${String(n).padStart(6, "0")}`,
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
      const n = get().invoices.length + 1001;
      const cust = get().customerById(input.customerId);
      const inv: Invoice = {
        id,
        number: `INV-2026-${String(n).padStart(6, "0")}`,
        customerId: input.customerId,
        salesOrderId: input.salesOrderId,
        date: input.date,
        dueDate: input.dueDate ?? daysAdd(input.date, cust?.paymentTermsDays ?? 30),
        lines: input.lines,
        notes: input.notes,
        status: "Draft",
        amountPaid: 0,
        createdBy: useIdentity.getState().user.id,
        createdAt: new Date().toISOString(),
        source: input.source ?? "Manual",
        emrInvoiceId: input.emrInvoiceId,
      };
      set((s) => ({ invoices: [inv, ...s.invoices] }));
      audit(`created invoice ${inv.number}`, `accounting/invoices/${inv.number}`);
      return id;
    },
    updateInvoice: (id, patch) => set((s) => ({ invoices: s.invoices.map((i) => (i.id === id && i.status === "Draft" ? { ...i, ...patch } : i)) })),

    issueInvoice: (id) => {
      const inv = get().invoices.find((i) => i.id === id);
      if (!inv || inv.status !== "Draft") return { ok: false, error: "Only a draft invoice can be issued." };
      const cust = get().customerById(inv.customerId);
      if (!cust) return { ok: false, error: "Customer not found." };
      if (!inv.lines.length || docTotal(inv.lines) <= 0) return { ok: false, error: "Add at least one line with an amount." };
      const je = postInvoiceJE(inv, cust);
      if (!je.ok) return { ok: false, error: je.error };
      set((s) => ({
        invoices: s.invoices.map((i) => (i.id === id ? { ...i, status: recomputeStatus({ ...i, status: "Open" }), journalEntryId: je.entry?.id, issuedAt: new Date().toISOString() } : i)),
      }));
      audit(`issued invoice ${inv.number}`, `accounting/invoices/${inv.number}`);
      return { ok: true };
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
      const allocTotal = round2(input.allocations.reduce((n, a) => n + a.amount, 0));
      if (allocTotal > input.amount + 0.01) return { ok: false, error: "Allocations exceed the amount received." };
      const id = `rcpt-${rid()}`;
      const n = get().receipts.length + 2001;
      const receipt: CustomerReceipt = {
        id,
        number: `RCT-2026-${String(n).padStart(6, "0")}`,
        customerId: input.customerId,
        date: input.date,
        method: input.method,
        depositAccountNumber: input.depositAccountNumber,
        amount: input.amount,
        allocations: input.allocations.filter((a) => a.amount > 0),
        reference: input.reference,
        notes: input.notes,
        createdBy: useIdentity.getState().user.id,
        createdAt: new Date().toISOString(),
      };
      const je = postReceiptJE(receipt, cust);
      if (!je.ok) return { ok: false, error: je.error };
      receipt.journalEntryId = je.entry?.id;
      set((s) => ({
        receipts: [receipt, ...s.receipts],
        invoices: s.invoices.map((i) => {
          const a = receipt.allocations.find((x) => x.invoiceId === i.id);
          if (!a) return i;
          const paid = round2(i.amountPaid + a.amount);
          return { ...i, amountPaid: paid, status: recomputeStatus({ ...i, amountPaid: paid }) };
        }),
      }));
      audit(`recorded receipt ${receipt.number} — ${cust.name}`, `accounting/receipts/${receipt.number}`);
      return { ok: true };
    },

    createCreditNote: (input) => {
      const cust = get().customerById(input.customerId)!;
      const id = `cn-${rid()}`;
      const n = get().creditNotes.length + 5001;
      const cn: CreditNote = {
        id,
        number: `CN-2026-${String(n).padStart(6, "0")}`,
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

    invoicesOf: (customerId) => get().invoices.filter((i) => i.customerId === customerId),
    openInvoicesOf: (customerId) => get().invoices.filter((i) => i.customerId === customerId && (i.status === "Open" || i.status === "Partially Paid" || i.status === "Overdue")),
    invoiceBalance: (inv) => round2(docTotal(inv.lines) - inv.amountPaid),
    customerBalance: (customerId) => {
      const cust = get().customerById(customerId);
      if (!cust) return 0;
      const open = get().invoices.filter((i) => i.customerId === customerId && i.status !== "Draft" && i.status !== "Void");
      const invBal = open.reduce((n, i) => n + round2(docTotal(i.lines) - i.amountPaid), 0);
      return round2(invBal);
    },
    agingFor: (asOf) => {
      const now = new Date(asOf).getTime();
      return get().customers.map((customer) => {
        const bucket = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
        get()
          .invoices.filter((i) => i.customerId === customer.id && (i.status === "Open" || i.status === "Partially Paid" || i.status === "Overdue"))
          .forEach((i) => {
            const bal = round2(docTotal(i.lines) - i.amountPaid);
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
