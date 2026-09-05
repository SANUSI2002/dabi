import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useLedger } from "@/store/accounting/useLedger";
import { seedTaxRates, seedTaxReturns, type TaxRate, type TaxReturn } from "@/data/accounting/tax";
import { ACCT } from "@/data/accounting/coa";

const rid = () => Math.random().toString(36).slice(2, 9);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type TaxState = {
  rates: TaxRate[];
  returns: TaxReturn[];

  rateById: (id?: string) => TaxRate | undefined;
  taxOn: (amount: number, rateId?: string) => number;

  addRate: (r: Omit<TaxRate, "id" | "isActive">) => void;
  updateRate: (id: string, patch: Partial<TaxRate>) => void;

  /** build a VAT return for a period from the movement on VAT Payable */
  prepareReturn: (periodStart: string, periodEnd: string) => TaxReturn;
  fileReturn: (id: string) => void;
  payReturn: (id: string, fromAccount: number) => void;
};

export const useTax = create<TaxState>((set, get) => ({
  rates: seedTaxRates,
  returns: seedTaxReturns,

  rateById: (id) => get().rates.find((r) => r.id === id),
  taxOn: (amount, rateId) => {
    const r = get().rateById(rateId);
    return r ? round2((amount * r.rate) / 100) : 0;
  },

  addRate: (r) => {
    set((s) => ({ rates: [...s.rates, { ...r, id: `tax-${rid()}`, isActive: true }] }));
    audit(`created tax rate ${r.name}`, `accounting/tax/${r.name}`);
  },
  updateRate: (id, patch) => {
    set((s) => ({ rates: s.rates.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
    audit(`updated tax rate`, `accounting/tax/${id}`);
  },

  prepareReturn: (periodStart, periodEnd) => {
    const led = useLedger.getState();
    // Output tax = credits to VAT Payable in the window; input tax = debits.
    const dc = led.debitCreditOf(ACCT.vatPayable, { asOf: periodEnd, from: periodStart });
    const output = round2(dc.credit);
    const input = round2(dc.debit);
    const ret: TaxReturn = {
      id: `vatret-${rid()}`,
      reference: `VAT-${new Date(periodEnd).getUTCFullYear()}-${String(new Date(periodEnd).getUTCMonth() + 1).padStart(2, "0")}`,
      kind: "VAT",
      periodStart,
      periodEnd,
      outputTax: output,
      inputTax: input,
      netPayable: round2(output - input),
      status: "Open",
    };
    set((s) => ({ returns: [ret, ...s.returns] }));
    audit(`prepared VAT return ${ret.reference}`, `accounting/tax/${ret.reference}`);
    return ret;
  },

  fileReturn: (id) => {
    set((s) => ({ returns: s.returns.map((r) => (r.id === id ? { ...r, status: "Filed", filedAt: new Date().toISOString() } : r)) }));
    const r = get().returns.find((x) => x.id === id);
    if (r) audit(`filed VAT return ${r.reference}`, `accounting/tax/${r.reference}`);
  },

  payReturn: (id, fromAccount) => {
    const r = get().returns.find((x) => x.id === id);
    if (!r || r.status === "Paid" || r.netPayable <= 0) return;
    const res = useLedger.getState().postJournal({
      date: new Date().toISOString(),
      source: "Tax",
      memo: `VAT remittance — ${r.reference}`,
      reference: r.reference,
      lines: [
        { accountNumber: ACCT.vatPayable, debit: r.netPayable, credit: 0, description: "VAT settled with FIRS" },
        { accountNumber: fromAccount, debit: 0, credit: r.netPayable, description: "Payment to FIRS" },
      ],
    });
    set((s) => ({ returns: s.returns.map((x) => (x.id === id ? { ...x, status: "Paid", paidAt: new Date().toISOString(), journalEntryId: res.entry?.id } : x)) }));
    audit(`paid VAT return ${r.reference}`, `accounting/tax/${r.reference}`);
  },
}));
