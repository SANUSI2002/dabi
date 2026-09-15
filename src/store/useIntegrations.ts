// Sabi platform integration layer.
//
// This is the ONLY module that imports across product boundaries. It reads EMR
// (useEmr) and Workforce/HR (usePayroll) domain events and translates them into
// Accounting transactions via the accountingApi façade. EMR and HR never import
// accounting; accounting never imports EMR or HR. Deploy any product alone and
// this file simply has nothing to sync.

import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useEmr } from "@/store/useEmr";
import { usePayroll } from "@/store/usePayroll";
import { accountingApi } from "@/integrations/accountingApi";
import { useLedger } from "@/store/accounting/useLedger";
import { useAR } from "@/store/accounting/useAR";
import { ACCT } from "@/data/accounting/coa";
import { SERVICE_TYPES } from "@/data/catalog";
import { useRevenueCycle } from "@/billing/useRevenueCycle";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// service category -> revenue account
function revenueAccountFor(code: string): number {
  const svc = SERVICE_TYPES.find((s) => s.code === code);
  const cat = (svc?.category ?? "").toLowerCase();
  if (cat.includes("lab")) return ACCT.laboratoryRevenue;
  if (cat.includes("pharm")) return ACCT.pharmacyRevenue;
  if (cat.includes("procedure")) return ACCT.procedureRevenue;
  if (cat.includes("mch")) return ACCT.admissionRevenue;
  return ACCT.consultationRevenue;
}

const depositAccountFor = (method?: string): { acct: number; label: "Cash" | "Bank Transfer" | "POS" } =>
  method === "Transfer" ? { acct: ACCT.bank, label: "Bank Transfer" } : method === "POS" ? { acct: ACCT.bank, label: "POS" } : { acct: ACCT.cashOnHand, label: "Cash" };

export type SyncResult = { module: string; created: number; skipped: number; errors: string[] };

type IntegrationsState = {
  autoSync: boolean;
  lastSyncAt?: string;
  results: SyncResult[];
  syncedEmrInvoiceIds: string[];
  postedPayrollBatches: string[];
  settledPayrollBatches: string[];
  dispensedRxIds: string[];
  syncedRevenueInvoiceIds: string[];
  syncedRevenuePaymentIds: string[];
  accountingInvoiceByRevenueId: Record<string, string>;
  accountingCustomerByAccountId: Record<string, string>;

  setAutoSync: (on: boolean) => void;
  pendingCounts: () => { emrBilling: number; payrollAccrual: number; payrollSettlement: number; pharmacy: number };
  syncEmrBilling: () => SyncResult;
  syncPayroll: () => SyncResult;
  syncPharmacy: () => SyncResult;
  syncAll: () => SyncResult[];
};

export const useIntegrations = create<IntegrationsState>((set, get) => ({
  autoSync: true,
  results: [],
  syncedEmrInvoiceIds: [],
  postedPayrollBatches: [],
  settledPayrollBatches: [],
  dispensedRxIds: [],
  syncedRevenueInvoiceIds: [],
  syncedRevenuePaymentIds: [],
  accountingInvoiceByRevenueId: {},
  accountingCustomerByAccountId: {},

  setAutoSync: (on) => {
    set({ autoSync: on });
    audit(`${on ? "enabled" : "disabled"} accounting auto-sync`, "integrations/settings");
  },

  pendingCounts: () => {
    const emr = useEmr.getState();
    const done = get().syncedEmrInvoiceIds;
    const revenue = useRevenueCycle.getState();
    const pendingRevenueInvoices = revenue.invoices.filter((invoice) => !invoice.id.startsWith("legacy-") && !get().syncedRevenueInvoiceIds.includes(invoice.id)).length;
    const pendingRevenuePayments = revenue.payments.filter((payment) => payment.status === "SUCCEEDED" && !payment.id.startsWith("legacy-") && !get().syncedRevenuePaymentIds.includes(payment.id)).length;
    const emrBilling = emr.invoices.filter((i) => !done.includes(i.id) && i.status !== "Waived").length + pendingRevenueInvoices + pendingRevenuePayments;

    const slips = usePayroll.getState().payslips;
    const batches = [...new Set(slips.map((s) => s.batch))];
    const payrollAccrual = batches.filter((b) => !get().postedPayrollBatches.includes(b) && slips.some((s) => s.batch === b && s.status !== "Draft")).length;
    const payrollSettlement = batches.filter((b) => get().postedPayrollBatches.includes(b) && !get().settledPayrollBatches.includes(b) && slips.filter((s) => s.batch === b).every((s) => s.status === "Paid")).length;

    const pharmacy = emr.encounters.flatMap((e) => e.prescriptions).filter((r) => r.status === "Dispensed" && !get().dispensedRxIds.includes(r.id)).length;
    return { emrBilling, payrollAccrual, payrollSettlement, pharmacy };
  },

  syncEmrBilling: () => {
    const emr = useEmr.getState();
    const revenue = useRevenueCycle.getState();
    const done = new Set(get().syncedEmrInvoiceIds);
    const result: SyncResult = { module: "EMR Billing", created: 0, skipped: 0, errors: [] };
    const newlySynced: string[] = [];
    const syncedRevenueInvoices: string[] = [];
    const syncedRevenuePayments: string[] = [];
    const accountingInvoiceByRevenueId = { ...get().accountingInvoiceByRevenueId };
    const accountingCustomerByAccountId = { ...get().accountingCustomerByAccountId };

    for (const inv of emr.invoices) {
      if (done.has(inv.id)) continue;
      if (inv.status === "Waived") { newlySynced.push(inv.id); result.skipped++; continue; }
      const patient = emr.patientById(inv.patientId);
      const isNhis = inv.payer === "NHIS";
      const custName = isNhis ? "NHIS — National Scheme" : "Walk-in Patients";
      const customerId = accountingApi.ensureCustomer({ key: custName, name: custName, type: isNhis ? "NHIS" : "Walk-in" });

      const lines = inv.lines.map((l) => ({
        id: `sl-${Math.random().toString(36).slice(2, 7)}`,
        accountNumber: revenueAccountFor(l.code),
        description: `${l.name}${patient ? ` — ${patient.firstName} ${patient.lastName}` : ""}`,
        qty: l.qty,
        unitPrice: l.unitPrice,
        taxRateId: "tax-vat-exempt",
      }));
      if (!lines.length) { newlySynced.push(inv.id); result.skipped++; continue; }

      const r = accountingApi.createAndIssueInvoice({ customerId, date: inv.createdAt, lines, emrInvoiceId: inv.id, notes: `From EMR ${inv.number}` });
      if (!r.ok) { result.errors.push(`${inv.number}: ${r.error}`); continue; }
      result.created++;

      if (inv.status === "Paid") {
        const total = round2(inv.lines.reduce((n, l) => n + l.qty * l.unitPrice, 0));
        const dep = depositAccountFor(inv.method);
        const pr = accountingApi.recordCustomerReceipt({ customerId, invoiceId: r.invoiceId, amount: total, date: inv.paidAt ?? inv.createdAt, method: dep.label, depositAccountNumber: dep.acct, reference: inv.number });
        if (!pr.ok) result.errors.push(`${inv.number} payment: ${pr.error}`);
      }
      newlySynced.push(inv.id);
    }

    // New revenue-cycle documents are posted independently. An invoice and its
    // later payments have separate idempotency ledgers, so partial payments can
    // never be lost merely because the invoice was synchronized earlier.
    for (const invoice of revenue.invoices) {
      if (invoice.id.startsWith("legacy-") || get().syncedRevenueInvoiceIds.includes(invoice.id)) continue;
      const patient = emr.patientById(invoice.patientId);
      const customerName = invoice.payer === "NHIS"
        ? "NHIS — National Scheme"
        : patient ? `${patient.firstName} ${patient.lastName} — ${patient.mrn}` : `Patient ${invoice.patientId}`;
      const customerId = accountingApi.ensureCustomer({ key: invoice.patientId, name: customerName, type: invoice.payer === "NHIS" ? "NHIS" : "Patient" });
      const lines = invoice.lines.map((line) => {
        const service = revenue.serviceCatalog.find((item) => item.code === line.serviceCode);
        return {
          id: `sl-${Math.random().toString(36).slice(2, 7)}`,
          accountNumber: Number(service?.revenueAccountCode) || revenueAccountFor(line.serviceCode),
          description: `${line.description}${patient ? ` — ${patient.firstName} ${patient.lastName}` : ""}`,
          qty: line.quantity,
          unitPrice: round2(line.unitPriceMinor / 100),
          taxRateId: "tax-vat-exempt",
        };
      });
      const posted = accountingApi.createAndIssueInvoice({ customerId, date: invoice.issuedAt, lines, emrInvoiceId: invoice.id, notes: `Patient account ${invoice.number} · encounter ${invoice.encounterId}` });
      if (!posted.ok) { result.errors.push(`${invoice.number}: ${posted.error}`); continue; }
      accountingInvoiceByRevenueId[invoice.id] = posted.invoiceId;
      accountingCustomerByAccountId[invoice.accountId] = customerId;
      syncedRevenueInvoices.push(invoice.id);
      result.created++;
    }

    const invoiceMapping = accountingInvoiceByRevenueId;
    for (const payment of revenue.payments) {
      if (payment.id.startsWith("legacy-") || payment.status !== "SUCCEEDED" || get().syncedRevenuePaymentIds.includes(payment.id)) continue;
      const allocations = revenue.allocations.filter((allocation) => allocation.paymentId === payment.id);
      let postedAll = allocations.length > 0;
      for (const allocation of allocations) {
        const sourceInvoice = revenue.invoices.find((invoice) => invoice.id === allocation.invoiceId);
        const accountingInvoiceId = invoiceMapping[allocation.invoiceId];
        const customerId = sourceInvoice ? accountingCustomerByAccountId[sourceInvoice.accountId] : undefined;
        if (!sourceInvoice || !accountingInvoiceId || !customerId) { postedAll = false; result.errors.push(`${payment.id}: invoice accounting link is not available`); continue; }
        const method = payment.method === "CARD_POS" ? { label: "POS" as const, account: ACCT.bank }
          : payment.method === "CASH" ? { label: "Cash" as const, account: ACCT.cashOnHand }
          : payment.method === "INSURANCE" ? { label: "NHIS Remittance" as const, account: ACCT.bank }
          : { label: "Bank Transfer" as const, account: ACCT.bank };
        const posted = accountingApi.recordCustomerReceipt({ customerId, invoiceId: accountingInvoiceId, amount: round2(allocation.amountMinor / 100), date: payment.paymentDate,
          method: method.label, depositAccountNumber: method.account, reference: payment.reference ?? payment.id });
        if (!posted.ok) { postedAll = false; result.errors.push(`${payment.id}: ${posted.error}`); }
        else result.created++;
      }
      if (postedAll) syncedRevenuePayments.push(payment.id);
    }

    set((s) => ({
      syncedEmrInvoiceIds: [...s.syncedEmrInvoiceIds, ...newlySynced],
      syncedRevenueInvoiceIds: [...s.syncedRevenueInvoiceIds, ...syncedRevenueInvoices],
      syncedRevenuePaymentIds: [...s.syncedRevenuePaymentIds, ...syncedRevenuePayments],
      accountingInvoiceByRevenueId,
      accountingCustomerByAccountId,
      lastSyncAt: new Date().toISOString(), results: [result, ...s.results.filter((x) => x.module !== result.module)],
    }));
    if (result.created || result.errors.length) audit(`synced ${result.created} EMR invoice(s) to Accounting`, "integrations/emr-billing");
    return result;
  },

  syncPayroll: () => {
    const slips = usePayroll.getState().payslips;
    const result: SyncResult = { module: "Payroll", created: 0, skipped: 0, errors: [] };
    const batches = [...new Set(slips.map((s) => s.batch))];
    const nowPosted: string[] = [];
    const nowSettled: string[] = [];

    for (const batch of batches) {
      const bs = slips.filter((s) => s.batch === batch);
      const ready = bs.filter((s) => s.status !== "Draft");
      // accrual
      if (!get().postedPayrollBatches.includes(batch) && ready.length > 0) {
        const gross = round2(ready.reduce((n, s) => n + s.grossPay, 0));
        const net = round2(ready.reduce((n, s) => n + s.netPay, 0));
        // mutually-exclusive buckets so a "PAYE Tax" line isn't counted under
        // both "paye" and "tax"
        const classify = (name: string): "paye" | "pension" | "nhf" | "loan" | "other" => {
          const n = name.toLowerCase();
          if (n.includes("paye") || n.includes("p.a.y.e") || (n.includes("tax") && !n.includes("nhf"))) return "paye";
          if (n.includes("pension")) return "pension";
          if (n.includes("nhf") || n.includes("housing fund")) return "nhf";
          if (n.includes("loan") || n.includes("advance")) return "loan";
          return "other";
        };
        const sums = { paye: 0, pension: 0, nhf: 0, loan: 0, other: 0 };
        for (const d of ready.flatMap((s) => s.deductions)) sums[classify(d.name)] = round2(sums[classify(d.name)] + d.amount);
        const { paye, pension, nhf, loan, other } = sums;
        const lines = [
          { accountNumber: ACCT.salaries, debit: gross, credit: 0, description: `Payroll — ${batch} (${ready.length} staff)` },
          ...(paye > 0 ? [{ accountNumber: ACCT.payePayable, debit: 0, credit: paye, description: "PAYE withheld" }] : []),
          ...(pension > 0 ? [{ accountNumber: ACCT.pensionPayable, debit: 0, credit: pension, description: "Pension withheld" }] : []),
          ...(nhf > 0 ? [{ accountNumber: ACCT.nhfPayable, debit: 0, credit: nhf, description: "NHF withheld" }] : []),
          ...(loan > 0 ? [{ accountNumber: ACCT.staffAdvances, debit: 0, credit: loan, description: "Staff loan recovery" }] : []),
          ...(other > 0.005 ? [{ accountNumber: ACCT.accruals, debit: 0, credit: other, description: "Other payroll deductions" }] : []),
          { accountNumber: ACCT.salariesPayable, debit: 0, credit: net, description: "Net pay owed to staff" },
        ];
        const r = accountingApi.postJournal({ date: bs[0].endDate, source: "Payroll", memo: `Payroll accrual — ${batch}`, reference: batch, lines });
        if (r.ok) { result.created++; nowPosted.push(batch); } else result.errors.push(`${batch} accrual: ${r.error}`);
      }
      // settlement
      const isPosted = get().postedPayrollBatches.includes(batch) || nowPosted.includes(batch);
      if (isPosted && !get().settledPayrollBatches.includes(batch) && bs.length > 0 && bs.every((s) => s.status === "Paid")) {
        const net = round2(bs.reduce((n, s) => n + s.netPay, 0));
        const r = accountingApi.postJournal({
          date: bs[0].paidAt ?? bs[0].endDate,
          source: "Payroll",
          memo: `Salaries paid — ${batch}`,
          reference: batch,
          lines: [
            { accountNumber: ACCT.salariesPayable, debit: net, credit: 0, description: "Clear net pay liability" },
            { accountNumber: ACCT.bank, debit: 0, credit: net, description: `Salary payment run — ${batch}` },
          ],
        });
        if (r.ok) { result.created++; nowSettled.push(batch); } else result.errors.push(`${batch} settlement: ${r.error}`);
      }
    }

    set((s) => ({ postedPayrollBatches: [...s.postedPayrollBatches, ...nowPosted], settledPayrollBatches: [...s.settledPayrollBatches, ...nowSettled], lastSyncAt: new Date().toISOString(), results: [result, ...s.results.filter((x) => x.module !== result.module)] }));
    if (result.created || result.errors.length) audit(`synced payroll to GL — ${result.created} entr(ies)`, "integrations/payroll");
    return result;
  },

  syncPharmacy: () => {
    const emr = useEmr.getState();
    const result: SyncResult = { module: "Pharmacy", created: 0, skipped: 0, errors: [] };
    const done = new Set(get().dispensedRxIds);
    const nowDone: string[] = [];
    for (const enc of emr.encounters) {
      for (const rx of enc.prescriptions) {
        if (rx.status !== "Dispensed" || done.has(rx.id)) continue;
        const r = accountingApi.issueInventoryByDrug(rx.drug, rx.qty, new Date().toISOString(), `Rx ${rx.id}`);
        if (r.ok) { result.created++; nowDone.push(rx.id); }
        else { result.skipped++; nowDone.push(rx.id); } // no linked item — mark done so we don't retry forever
      }
    }
    set((s) => ({ dispensedRxIds: [...s.dispensedRxIds, ...nowDone], lastSyncAt: new Date().toISOString(), results: [result, ...s.results.filter((x) => x.module !== result.module)] }));
    if (result.created) audit(`posted pharmacy COGS for ${result.created} dispensed item(s)`, "integrations/pharmacy");
    return result;
  },

  syncAll: () => {
    const r = [get().syncEmrBilling(), get().syncPayroll(), get().syncPharmacy()];
    void useLedger.getState();
    void useAR.getState();
    return r;
  },
}));
