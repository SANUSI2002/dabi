// Sabi Accounting — public integration API.
//
// This is the ONLY surface other products (EMR, Workforce/HR) are meant to touch.
// It is a thin façade over the accounting stores so callers never reach into
// accounting's internal state shape. Mirrors the reference brief's section 20:
// create invoice, record payment, create bill, record expense, post journal,
// get balances, get financial statements, reverse.

import { useLedger, type DraftLine } from "@/store/accounting/useLedger";
import { useAR } from "@/store/accounting/useAR";
import { useAP } from "@/store/accounting/useAP";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { profitAndLoss, balanceSheet, cashFlow } from "@/store/accounting/useAccountingReports";
import type { JournalSource } from "@/data/accounting/journal";
import type { SalesLine } from "@/data/accounting/receivables";

export const accountingApi = {
  // ---- general ledger ----
  postJournal(input: { date: string; source: JournalSource; memo: string; reference?: string; lines: DraftLine[] }) {
    return useLedger.getState().postJournal(input);
  },
  reverseEntry(journalEntryId: string, opts?: { date?: string; memo?: string }) {
    return useLedger.getState().reverseEntry(journalEntryId, opts);
  },
  getAccountBalance(accountNumber: number, asOf?: string) {
    return useLedger.getState().balanceOf(accountNumber, asOf);
  },

  // ---- receivables ----
  ensureCustomer(input: { key: string; name: string; type: "Patient" | "NHIS" | "HMO" | "Corporate" | "Walk-in" }) {
    const existing = useAR.getState().customers.find((c) => c.name === input.name);
    if (existing) return existing.id;
    return useAR.getState().addCustomer({ name: input.name, type: input.type, paymentTermsDays: input.type === "Walk-in" ? 0 : 30, creditLimit: 0 });
  },
  createAndIssueInvoice(input: { customerId: string; date: string; lines: SalesLine[]; emrInvoiceId?: string; dueDate?: string; notes?: string }) {
    const id = useAR.getState().createInvoice({ customerId: input.customerId, date: input.date, dueDate: input.dueDate, lines: input.lines, notes: input.notes, source: "EMR Billing", emrInvoiceId: input.emrInvoiceId });
    const res = useAR.getState().issueInvoice(id);
    return { invoiceId: id, ...res };
  },
  recordCustomerReceipt(input: { customerId: string; invoiceId: string; amount: number; date: string; method: "Cash" | "Bank Transfer" | "POS" | "Cheque" | "NHIS Remittance"; depositAccountNumber: number; reference?: string }) {
    return useAR.getState().recordReceipt({ customerId: input.customerId, date: input.date, method: input.method, depositAccountNumber: input.depositAccountNumber, amount: input.amount, allocations: [{ invoiceId: input.invoiceId, amount: input.amount }], reference: input.reference });
  },
  getCustomerBalance(customerId: string) {
    return useAR.getState().customerBalance(customerId);
  },

  // ---- payables ----
  getVendorBalance(vendorId: string) {
    return useAP.getState().vendorBalance(vendorId);
  },

  // ---- inventory ----
  issueInventoryByDrug(drugName: string, qty: number, date: string, reference?: string) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9/]/g, "");
    const item = useInventoryAccounting.getState().items.find((i) => i.linkedDrugId && norm(drugName).includes(norm(i.linkedDrugId)));
    if (!item) return { ok: false as const, error: `No inventory item linked to "${drugName}"`, cogs: 0 };
    return useInventoryAccounting.getState().issueStock({ itemId: item.id, qty, date, reference, note: `Dispensed: ${drugName}` });
  },

  // ---- financial statements ----
  statements(from: string, to: string) {
    return { profitAndLoss: profitAndLoss(from, to), balanceSheet: balanceSheet(to), cashFlow: cashFlow(from, to) };
  },
};

export type AccountingApi = typeof accountingApi;
