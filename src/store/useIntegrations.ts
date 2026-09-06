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

  setAutoSync: (on) => {
    set({ autoSync: on });
    audit(`${on ? "enabled" : "disabled"} accounting auto-sync`, "integrations/settings");
  },

  pendingCounts: () => {
    const emr = useEmr.getState();
    const done = get().syncedEmrInvoiceIds;
    const emrBilling = emr.invoices.filter((i) => !done.includes(i.id) && i.status !== "Waived").length;

    const slips = usePayroll.getState().payslips;
    const batches = [...new Set(slips.map((s) => s.batch))];
    const payrollAccrual = batches.filter((b) => !get().postedPayrollBatches.includes(b) && slips.some((s) => s.batch === b && s.status !== "Draft")).length;
    const payrollSettlement = batches.filter((b) => get().postedPayrollBatches.includes(b) && !get().settledPayrollBatches.includes(b) && slips.filter((s) => s.batch === b).every((s) => s.status === "Paid")).length;

    const pharmacy = emr.encounters.flatMap((e) => e.prescriptions).filter((r) => r.status === "Dispensed" && !get().dispensedRxIds.includes(r.id)).length;
    return { emrBilling, payrollAccrual, payrollSettlement, pharmacy };
  },

  syncEmrBilling: () => {
    const emr = useEmr.getState();
    const done = new Set(get().syncedEmrInvoiceIds);
    const result: SyncResult = { module: "EMR Billing", created: 0, skipped: 0, errors: [] };
    const newlySynced: string[] = [];

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

    set((s) => ({ syncedEmrInvoiceIds: [...s.syncedEmrInvoiceIds, ...newlySynced], lastSyncAt: new Date().toISOString(), results: [result, ...s.results.filter((x) => x.module !== result.module)] }));
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
