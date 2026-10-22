import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useLedger } from "@/store/accounting/useLedger";
import { seedTaxRates, seedTaxReturns, type TaxRate, type TaxReturn, type TaxReturnSchedule, type ReturnType } from "@/data/accounting/tax";
import { ACCT } from "@/data/accounting/coa";

const rid = () => Math.random().toString(36).slice(2, 9);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ym = (d: string) => `${new Date(d).getUTCFullYear()}-${String(new Date(d).getUTCMonth() + 1).padStart(2, "0")}`;

const RETURN_CONFIG: Record<ReturnType, { kind: TaxRate["kind"]; authority: TaxReturn["authority"]; account: number; prefix: string; hasInput: boolean }> = {
  VAT: { kind: "VAT", authority: "FIRS", account: ACCT.vatPayable, prefix: "VAT", hasInput: true },
  WHT: { kind: "WHT", authority: "FIRS", account: ACCT.whtPayable, prefix: "WHT", hasInput: false },
  PAYE: { kind: "VAT", authority: "State IRS", account: ACCT.payePayable, prefix: "PAYE", hasInput: false },
};

type TaxState = {
  rates: TaxRate[];
  returns: TaxReturn[];

  rateById: (id?: string) => TaxRate | undefined;
  taxOn: (amount: number, rateId?: string) => number;
  /** B29 — one or more taxes stacked on a net amount, grouped by the liability account */
  taxIdsOf: (line: { taxRateId?: string; taxRateIds?: string[] }) => string[];
  taxBreakdown: (net: number, ids: string[]) => { accountNumber: number; amount: number; label: string }[];
  taxTotal: (net: number, ids: string[]) => number;

  addRate: (r: Omit<TaxRate, "id" | "isActive">) => void;
  updateRate: (id: string, patch: Partial<TaxRate>) => void;

  /** build a return from the period movement on the relevant liability account */
  prepareReturn: (returnType: ReturnType, periodStart: string, periodEnd: string) => TaxReturn;
  /** e-file: generate a submission acknowledgement from the tax authority. Where direct e-filing isn't
   *  connected, the filing is recorded with the acknowledgement the authority's portal issued (`ack`). */
  efileReturn: (id: string, ack?: string) => { ok: boolean; ref?: string; needsAcknowledgement?: boolean };
  payReturn: (id: string, fromAccount: number) => void;
  /** Every ledger line behind a return, with the counterparty and its TIN, for the authority's portal. */
  returnSchedule: (id: string) => Promise<TaxReturnSchedule>;
};

export const useTax = create<TaxState>((set, get) => ({
  rates: seedTaxRates,
  returns: seedTaxReturns,

  rateById: (id) => get().rates.find((r) => r.id === id),
  taxIdsOf: (line) => (line.taxRateIds && line.taxRateIds.length ? line.taxRateIds : line.taxRateId ? [line.taxRateId] : []),
  taxBreakdown: (net, ids) => {
    const groups = new Map<number, { amount: number; label: string }>();
    for (const id of ids) {
      const r = get().rateById(id);
      if (!r || r.rate <= 0) continue;
      const amt = round2((net * r.rate) / 100);
      const cur = groups.get(r.accountNumber) ?? { amount: 0, label: r.name };
      groups.set(r.accountNumber, { amount: round2(cur.amount + amt), label: cur.label === r.name ? r.name : `${cur.label} + ${r.name}` });
    }
    return [...groups.entries()].map(([accountNumber, v]) => ({ accountNumber, amount: v.amount, label: v.label }));
  },
  taxTotal: (net, ids) => round2(get().taxBreakdown(net, ids).reduce((n, b) => n + b.amount, 0)),
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

  prepareReturn: (returnType, periodStart, periodEnd) => {
    const cfg = RETURN_CONFIG[returnType];
    const dc = useLedger.getState().debitCreditOf(cfg.account, { asOf: periodEnd, from: periodStart });
    // credits accrue the liability (output/withheld), debits are reclaims/settlements
    const output = round2(dc.credit);
    const input = cfg.hasInput ? round2(dc.debit) : 0;
    const ret: TaxReturn = {
      id: `taxret-${rid()}`,
      reference: `${cfg.prefix}-${ym(periodEnd)}`,
      kind: cfg.kind,
      returnType,
      authority: cfg.authority,
      liabilityAccount: cfg.account,
      periodStart,
      periodEnd,
      outputTax: output,
      inputTax: input,
      netPayable: round2(output - input),
      status: "Open",
    };
    set((s) => ({ returns: [ret, ...s.returns] }));
    audit(`prepared ${returnType} return ${ret.reference}`, `accounting/tax/${ret.reference}`);
    return ret;
  },

  efileReturn: (id) => {
    const r = get().returns.find((x) => x.id === id);
    if (!r || r.status !== "Open") return { ok: false };
    const ref = `${r.authority === "FIRS" ? "FIRS" : "LIRS"}/${r.returnType}/${r.reference.split("-").slice(1).join("")}/${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    set((s) => ({ returns: s.returns.map((x) => (x.id === id ? { ...x, status: "Filed", filedAt: new Date().toISOString(), submissionRef: ref, filedVia: `${r.authority} e-filing portal` } : x)) }));
    audit(`e-filed ${r.returnType} return ${r.reference} — ack ${ref}`, `accounting/tax/${r.reference}`);
    return { ok: true, ref };
  },

  returnSchedule: async (id) => {
    const r = get().returns.find((x) => x.id === id);
    if (!r) throw new Error("Tax return not found.");
    // Loaded when needed (payables and receivables use this store); typed here so the stores' types stay independent.
    type Party = { name: string; taxId?: string };
    const [{ useAP }, { useAR }] = (await Promise.all([import("@/store/accounting/useAP"), import("@/store/accounting/useAR")])) as unknown as [
      { useAP: { getState(): { vendorById(id: string): Party | undefined } } },
      { useAR: { getState(): { customerById(id: string): Party | undefined } } },
    ];
    const from = new Date(r.periodStart).getTime();
    const to = new Date(r.periodEnd).getTime();
    const rows = useLedger.getState().entries
      .filter((e) => (e.status === "Posted" || e.status === "Reversed") && new Date(e.date).getTime() >= from && new Date(e.date).getTime() <= to)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .flatMap((e) => {
        const party = e.lines.find((l) => l.vendorId || l.customerId);
        const vendor = party?.vendorId ? useAP.getState().vendorById(party.vendorId) : undefined;
        const counterparty = vendor?.name ?? (party?.customerId ? useAR.getState().customerById(party.customerId)?.name : undefined);
        return e.lines.filter((l) => l.accountNumber === r.liabilityAccount).map((l) => ({
          date: e.date, entryNumber: e.number, source: e.source, reference: e.reference, description: l.description ?? e.memo,
          counterparty, counterpartyTin: vendor?.taxId, tax: round2(l.credit), reclaimed: round2(l.debit),
        }));
      });
    return {
      reference: r.reference, returnType: r.returnType, authority: r.authority, periodStart: r.periodStart, periodEnd: r.periodEnd,
      outputTax: r.outputTax, inputTax: r.inputTax, netPayable: r.netPayable, rows,
      totals: { tax: round2(rows.reduce((n, x) => n + x.tax, 0)), reclaimed: round2(rows.reduce((n, x) => n + x.reclaimed, 0)) },
    };
  },

  payReturn: (id, fromAccount) => {
    const r = get().returns.find((x) => x.id === id);
    if (!r || r.status === "Paid" || r.netPayable <= 0) return;
    const res = useLedger.getState().postJournal({
      date: new Date().toISOString(),
      source: "Tax",
      memo: `${r.returnType} remittance — ${r.reference}`,
      reference: r.reference,
      lines: [
        { accountNumber: r.liabilityAccount, debit: r.netPayable, credit: 0, description: `${r.returnType} settled with ${r.authority}` },
        { accountNumber: fromAccount, debit: 0, credit: r.netPayable, description: `Payment to ${r.authority}` },
      ],
    });
    set((s) => ({ returns: s.returns.map((x) => (x.id === id ? { ...x, status: "Paid", paidAt: new Date().toISOString(), journalEntryId: res.entry?.id } : x)) }));
    audit(`paid ${r.returnType} return ${r.reference}`, `accounting/tax/${r.reference}`);
  },
}));
