import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { useLedger } from "@/store/accounting/useLedger";
import { ACCT } from "@/data/accounting/coa";
import { seedFixedAssets, seedDepreciationRuns, type FixedAsset, type DepreciationMethod, type DepreciationRun, type DepreciationRunEntry } from "@/data/accounting/fixedAssets";

const rid = () => Math.random().toString(36).slice(2, 9);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export const netBookValue = (a: FixedAsset) => round2(a.cost - a.accumulatedDepreciation);

/** Depreciation charge for one month, respecting the depreciable floor. */
export function monthlyDepreciation(a: FixedAsset): number {
  const floor = a.cost - a.salvageValue;
  if (a.accumulatedDepreciation >= floor - 0.01 || a.status !== "Active") return 0;
  let charge: number;
  if (a.method === "Straight Line") {
    charge = floor / a.usefulLifeMonths;
  } else {
    const rate = (a.reducingRateAnnual ?? 20) / 100 / 12;
    charge = netBookValue(a) * rate;
  }
  return round2(Math.min(charge, floor - a.accumulatedDepreciation));
}

type FAState = {
  assets: FixedAsset[];
  runs: DepreciationRun[];

  assetById: (id: string) => FixedAsset | undefined;
  addAsset: (input: { name: string; category: string; acquisitionDate: string; cost: number; assetAccountNumber: number; method: DepreciationMethod; usefulLifeMonths: number; salvageValue: number; reducingRateAnnual?: number; fundedFromAccount?: number; sourceBillId?: string }) => string;
  retireAsset: (id: string) => void;

  previewRun: (period: string) => { entries: DepreciationRunEntry[]; total: number };
  runDepreciation: (period: string) => { ok: boolean; error?: string };

  disposeAsset: (id: string, input: { date: string; proceeds: number; proceedsAccount: number }) => { ok: boolean; error?: string };

  scheduleFor: (a: FixedAsset, months?: number) => { period: string; charge: number; accumulated: number; nbv: number }[];
};

export const useFixedAssets = create<FAState>((set, get) => ({
  assets: seedFixedAssets,
  runs: seedDepreciationRuns,

  assetById: (id) => get().assets.find((a) => a.id === id),

  addAsset: (input) => {
    const id = `fa-${rid()}`;
    const n = get().assets.length + 1;
    const asset: FixedAsset = {
      id,
      tag: `FA-${String(n).padStart(4, "0")}`,
      name: input.name,
      category: input.category,
      acquisitionDate: input.acquisitionDate,
      cost: input.cost,
      assetAccountNumber: input.assetAccountNumber,
      method: input.method,
      usefulLifeMonths: input.usefulLifeMonths,
      salvageValue: input.salvageValue,
      reducingRateAnnual: input.reducingRateAnnual,
      accumulatedDepreciation: 0,
      status: "Active",
      sourceBillId: input.sourceBillId,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ assets: [asset, ...s.assets] }));
    audit(`registered fixed asset ${asset.tag} — ${asset.name}`, `accounting/fixed-assets/${asset.tag}`);
    // If not already on the books via a bill, capitalise it now.
    if (!input.sourceBillId && input.fundedFromAccount) {
      useLedger.getState().postJournal({
        date: input.acquisitionDate,
        source: "Manual",
        memo: `Capitalise ${asset.tag} — ${asset.name}`,
        reference: asset.tag,
        lines: [
          { accountNumber: input.assetAccountNumber, debit: input.cost, credit: 0, description: asset.name },
          { accountNumber: input.fundedFromAccount, debit: 0, credit: input.cost, description: `Acquisition of ${asset.tag}` },
        ],
      });
    }
    return id;
  },

  retireAsset: (id) => {
    set((s) => ({ assets: s.assets.map((a) => (a.id === id ? { ...a, status: "Disposed" } : a)) }));
    audit(`retired fixed asset`, `accounting/fixed-assets/${id}`);
  },

  previewRun: (period) => {
    const entries: DepreciationRunEntry[] = [];
    for (const a of get().assets) {
      if (a.status !== "Active") continue;
      if (a.lastDepreciatedPeriod && a.lastDepreciatedPeriod >= period) continue;
      const amount = monthlyDepreciation(a);
      if (amount <= 0) continue;
      entries.push({ assetId: a.id, amount, nbvBefore: netBookValue(a), nbvAfter: round2(netBookValue(a) - amount) });
    }
    return { entries, total: round2(entries.reduce((n, e) => n + e.amount, 0)) };
  },

  runDepreciation: (period) => {
    if (get().runs.some((r) => r.period === period)) return { ok: false, error: `Depreciation for ${period} has already been run.` };
    const { entries, total } = get().previewRun(period);
    if (!entries.length) return { ok: false, error: "Nothing to depreciate for that period." };
    const [py, pm] = period.split("-").map(Number);
    const periodDate = new Date(Math.min(Date.UTC(py, pm, 0, 12), Date.now())).toISOString();
    const lock = useLedger.getState().isDateLocked(periodDate);
    if (lock.locked) return { ok: false, error: lock.reason };

    const je = useLedger.getState().postJournal({
      date: periodDate,
      source: "Depreciation",
      memo: `Depreciation — ${period}`,
      reference: period,
      lines: [
        { accountNumber: ACCT.depreciationExpense, debit: total, credit: 0, description: `Depreciation expense — ${period}` },
        { accountNumber: ACCT.accumDepreciation, debit: 0, credit: total, description: `Accumulated depreciation — ${period}` },
      ],
    });
    if (!je.ok) return { ok: false, error: je.error };

    const runBy = useIdentity.getState().user.id;
    const run: DepreciationRun = { id: `dr-${rid()}`, period, runDate: new Date().toISOString(), entries, total, journalEntryId: je.entry?.id, runBy };
    set((s) => ({
      runs: [run, ...s.runs],
      assets: s.assets.map((a) => {
        const e = entries.find((x) => x.assetId === a.id);
        if (!e) return a;
        const accum = round2(a.accumulatedDepreciation + e.amount);
        const fullyDep = accum >= a.cost - a.salvageValue - 0.01;
        return { ...a, accumulatedDepreciation: accum, lastDepreciatedPeriod: period, status: fullyDep ? "Fully Depreciated" : a.status };
      }),
    }));
    audit(`ran depreciation for ${period} — ${total.toLocaleString()}`, `accounting/fixed-assets/depreciation/${period}`);
    return { ok: true };
  },

  disposeAsset: (id, input) => {
    const a = get().assetById(id);
    if (!a) return { ok: false, error: "Asset not found." };
    if (a.status === "Disposed") return { ok: false, error: "Already disposed." };
    const nbv = netBookValue(a);
    const gainLoss = round2(input.proceeds - nbv); // + gain, - loss
    const lines: { accountNumber: number; debit: number; credit: number; description?: string }[] = [
      { accountNumber: input.proceedsAccount, debit: input.proceeds, credit: 0, description: `Proceeds — ${a.tag}` },
      { accountNumber: ACCT.accumDepreciation, debit: a.accumulatedDepreciation, credit: 0, description: `Clear accum. depreciation — ${a.tag}` },
      { accountNumber: a.assetAccountNumber, debit: 0, credit: a.cost, description: `Derecognise cost — ${a.tag}` },
    ];
    if (gainLoss > 0.01) lines.push({ accountNumber: ACCT.otherIncome, debit: 0, credit: gainLoss, description: `Gain on disposal — ${a.tag}` });
    else if (gainLoss < -0.01) lines.push({ accountNumber: ACCT.miscExpense, debit: -gainLoss, credit: 0, description: `Loss on disposal — ${a.tag}` });

    const je = useLedger.getState().postJournal({ date: input.date, source: "Manual", memo: `Disposal of ${a.tag} — ${a.name}`, reference: a.tag, lines });
    if (!je.ok) return { ok: false, error: je.error };
    set((s) => ({ assets: s.assets.map((x) => (x.id === id ? { ...x, status: "Disposed", disposalDate: input.date, disposalProceeds: input.proceeds } : x)) }));
    audit(`disposed of ${a.tag} — proceeds ${input.proceeds.toLocaleString()}, ${gainLoss >= 0 ? "gain" : "loss"} ${Math.abs(gainLoss).toLocaleString()}`, `accounting/fixed-assets/${a.tag}`);
    return { ok: true };
  },

  scheduleFor: (a, months = 12) => {
    const rows: { period: string; charge: number; accumulated: number; nbv: number }[] = [];
    let accum = a.accumulatedDepreciation;
    const floor = a.cost - a.salvageValue;
    const start = new Date();
    for (let i = 0; i < months; i++) {
      const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
      let charge = 0;
      if (accum < floor - 0.01) {
        charge = a.method === "Straight Line" ? floor / a.usefulLifeMonths : round2((a.cost - accum) * ((a.reducingRateAnnual ?? 20) / 100 / 12));
        charge = round2(Math.min(charge, floor - accum));
      }
      accum = round2(accum + charge);
      rows.push({ period: ym(d), charge, accumulated: accum, nbv: round2(a.cost - accum) });
    }
    return rows;
  },
}));

export { seedFixedAssets };
