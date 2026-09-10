import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { useLedger } from "@/store/accounting/useLedger";
import { ACCT } from "@/data/accounting/coa";
import { seedFixedAssets, seedDepreciationRuns, seedAssetRevaluations, type FixedAsset, type DepreciationMethod, type DepreciationRun, type DepreciationRunEntry, type AssetRevaluation } from "@/data/accounting/fixedAssets";

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
  revaluations: AssetRevaluation[];

  assetById: (id: string) => FixedAsset | undefined;
  revaluationsFor: (assetId: string) => AssetRevaluation[];
  // B28 — revalue / impair an asset to a new carrying amount
  revalueAsset: (id: string, input: { newCarryingValue: number; date: string; note?: string }) => { ok: boolean; error?: string };
  // B28 — construction in progress
  startConstruction: (input: { name: string; category: string; assetAccountNumber: number; startDate: string }) => string;
  addCwipCost: (id: string, input: { amount: number; date: string; description: string; fromAccount: number }) => { ok: boolean; error?: string };
  capitaliseCwip: (id: string, input: { date: string; method: DepreciationMethod; usefulLifeMonths: number; salvageValue: number; reducingRateAnnual?: number }) => { ok: boolean; error?: string };
  addAsset: (input: { name: string; category: string; acquisitionDate: string; cost: number; assetAccountNumber: number; method: DepreciationMethod; usefulLifeMonths: number; salvageValue: number; reducingRateAnnual?: number; fundedFromAccount?: number; sourceBillId?: string }) => string;
  retireAsset: (id: string) => void;

  previewRun: (period: string) => { entries: DepreciationRunEntry[]; total: number };
  runDepreciation: (period: string) => { ok: boolean; error?: string };
  /** B23 — months from the earliest un-depreciated asset through `throughPeriod` that have no run yet */
  pendingDepreciationPeriods: (throughPeriod?: string) => string[];
  catchUpDepreciation: (throughPeriod?: string) => { ran: string[]; total: number };

  disposeAsset: (id: string, input: { date: string; proceeds: number; proceedsAccount: number }) => { ok: boolean; error?: string };

  scheduleFor: (a: FixedAsset, months?: number) => { period: string; charge: number; accumulated: number; nbv: number }[];
};

export const useFixedAssets = create<FAState>((set, get) => ({
  assets: seedFixedAssets,
  runs: seedDepreciationRuns,
  revaluations: seedAssetRevaluations,

  assetById: (id) => get().assets.find((a) => a.id === id),
  revaluationsFor: (assetId) => get().revaluations.filter((r) => r.assetId === assetId),

  revalueAsset: (id, input) => {
    const a = get().assetById(id);
    if (!a) return { ok: false, error: "Asset not found." };
    if (a.status === "Disposed" || a.status === "Under Construction") return { ok: false, error: "Can't revalue this asset." };
    const carryingBefore = round2(a.cost - a.accumulatedDepreciation + (a.revaluationReserve ?? 0) - (a.impairmentLoss ?? 0));
    const delta = round2(input.newCarryingValue - carryingBefore);
    if (Math.abs(delta) < 0.005) return { ok: false, error: "New value matches the current carrying amount." };
    const led = useLedger.getState();
    let je;
    const priorImpair = a.impairmentLoss ?? 0;
    if (delta > 0) {
      // uplift: first reverse any prior impairment to P&L (impairment reversal), rest to Revaluation Reserve
      const reversal = Math.min(delta, priorImpair);
      const toReserve = round2(delta - reversal);
      const lines: { accountNumber: number; debit: number; credit: number; description?: string }[] = [
        { accountNumber: a.assetAccountNumber, debit: delta, credit: 0, description: `Revaluation uplift — ${a.tag}` },
      ];
      if (reversal > 0) lines.push({ accountNumber: ACCT.impairmentLoss, debit: 0, credit: reversal, description: "Impairment reversal" });
      if (toReserve > 0) lines.push({ accountNumber: ACCT.revaluationReserve, debit: 0, credit: toReserve, description: "Revaluation surplus" });
      je = led.postJournal({ date: input.date, source: "Manual", memo: `Revaluation — ${a.name}`, reference: a.tag, lines });
    } else {
      // writedown: absorb against reserve first, remainder to Impairment Loss
      const amt = -delta;
      const fromReserve = Math.min(amt, a.revaluationReserve ?? 0);
      const toImpair = round2(amt - fromReserve);
      const lines: { accountNumber: number; debit: number; credit: number; description?: string }[] = [];
      if (fromReserve > 0) lines.push({ accountNumber: ACCT.revaluationReserve, debit: fromReserve, credit: 0, description: "Reverse revaluation surplus" });
      if (toImpair > 0) lines.push({ accountNumber: ACCT.impairmentLoss, debit: toImpair, credit: 0, description: `Impairment — ${a.tag}` });
      lines.push({ accountNumber: a.assetAccountNumber, debit: 0, credit: amt, description: `Writedown — ${a.tag}` });
      je = led.postJournal({ date: input.date, source: "Manual", memo: `Impairment — ${a.name}`, reference: a.tag, lines });
    }
    if (!je.ok) return { ok: false, error: je.error };
    set((s) => ({
      assets: s.assets.map((x) => {
        if (x.id !== id) return x;
        const revReserve = round2((x.revaluationReserve ?? 0) + (delta > 0 ? Math.max(0, delta - priorImpair) : -Math.min(-delta, x.revaluationReserve ?? 0)));
        const impair = round2((x.impairmentLoss ?? 0) + (delta > 0 ? -Math.min(delta, priorImpair) : Math.max(0, -delta - (x.revaluationReserve ?? 0))));
        return { ...x, cost: round2(x.cost + delta), revaluationReserve: Math.max(0, revReserve), impairmentLoss: Math.max(0, impair), status: impair > 0 && delta < 0 ? "Impaired" as const : x.status === "Impaired" && delta > 0 ? "Active" as const : x.status };
      }),
      revaluations: [{ id: `rv-${rid()}`, assetId: id, date: input.date, kind: delta > 0 ? (priorImpair > 0 ? "Reversal" : "Revaluation") : "Impairment", carryingBefore, carryingAfter: input.newCarryingValue, delta, note: input.note, journalEntryId: je.entry?.id, by: useIdentity.getState().user.id }, ...s.revaluations],
    }));
    audit(`${delta > 0 ? "revalued up" : "impaired"} ${a.tag} by ${Math.abs(delta).toLocaleString()}`, `accounting/fixed-assets/${a.tag}`);
    return { ok: true };
  },

  startConstruction: (input) => {
    const id = `fa-${rid()}`;
    const tag = `CWIP-${String(get().assets.length + 1).padStart(4, "0")}`;
    set((s) => ({ assets: [{ id, tag, name: input.name, category: input.category, acquisitionDate: input.startDate, cost: 0, assetAccountNumber: input.assetAccountNumber, method: "Straight Line", usefulLifeMonths: 0, salvageValue: 0, accumulatedDepreciation: 0, status: "Under Construction", cwipSpend: 0, createdAt: new Date().toISOString() }, ...s.assets] }));
    audit(`opened CWIP asset ${tag} — ${input.name}`, `accounting/fixed-assets/${tag}`);
    return id;
  },
  addCwipCost: (id, input) => {
    const a = get().assetById(id);
    if (!a || a.status !== "Under Construction") return { ok: false, error: "Not a construction-in-progress asset." };
    const je = useLedger.getState().postJournal({
      date: input.date, source: "Manual", memo: `CWIP cost — ${a.name}: ${input.description}`, reference: a.tag,
      lines: [
        { accountNumber: ACCT.assetsUnderConstruction, debit: round2(input.amount), credit: 0, description: input.description },
        { accountNumber: input.fromAccount, debit: 0, credit: round2(input.amount), description: `Paid for ${a.name} works` },
      ],
    });
    if (!je.ok) return { ok: false, error: je.error };
    set((s) => ({ assets: s.assets.map((x) => (x.id === id ? { ...x, cwipSpend: round2((x.cwipSpend ?? 0) + input.amount) } : x)) }));
    audit(`added ${input.amount.toLocaleString()} to CWIP ${a.tag}`, `accounting/fixed-assets/${a.tag}`);
    return { ok: true };
  },
  capitaliseCwip: (id, input) => {
    const a = get().assetById(id);
    if (!a || a.status !== "Under Construction") return { ok: false, error: "Not a construction-in-progress asset." };
    const total = round2(a.cwipSpend ?? 0);
    if (total <= 0) return { ok: false, error: "No costs accumulated yet." };
    const je = useLedger.getState().postJournal({
      date: input.date, source: "Manual", memo: `Capitalise ${a.name} — placed in service`, reference: a.tag,
      lines: [
        { accountNumber: a.assetAccountNumber, debit: total, credit: 0, description: `${a.name} capitalised` },
        { accountNumber: ACCT.assetsUnderConstruction, debit: 0, credit: total, description: `CWIP transferred — ${a.tag}` },
      ],
    });
    if (!je.ok) return { ok: false, error: je.error };
    set((s) => ({
      assets: s.assets.map((x) => (x.id === id ? {
        ...x, cost: total, status: "Active" as const, acquisitionDate: input.date,
        method: input.method, usefulLifeMonths: input.usefulLifeMonths, salvageValue: input.salvageValue, reducingRateAnnual: input.reducingRateAnnual,
        tag: x.tag.replace("CWIP-", "FA-"),
      } : x)),
    }));
    audit(`capitalised CWIP ${a.tag} — ${total.toLocaleString()} placed in service`, `accounting/fixed-assets/${a.tag}`);
    return { ok: true };
  },

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

  pendingDepreciationPeriods: (throughPeriod) => {
    const now = new Date();
    const through = throughPeriod ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const active = get().assets.filter((a) => a.status === "Active" || a.status === "Fully Depreciated");
    if (!active.length) return [];
    // don't try to depreciate into locked periods — start no earlier than the books-locked-before month
    const lock = useLedger.getState().booksLockedBefore;
    const lockMonth = lock ? lock.slice(0, 7) : "0000-00";
    const starts = active.map((a) => a.acquisitionDate.slice(0, 7));
    let cursor = [starts.sort()[0], lockMonth].sort().reverse()[0];
    const done = new Set(get().runs.map((r) => r.period));
    const out: string[] = [];
    let guard = 0;
    while (cursor <= through && guard++ < 240) {
      if (!done.has(cursor)) {
        const { entries } = get().previewRun(cursor);
        if (entries.length) out.push(cursor);
      }
      const [y, m] = cursor.split("-").map(Number);
      const d = new Date(Date.UTC(y, m, 1));
      cursor = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    return out;
  },
  catchUpDepreciation: (throughPeriod) => {
    const pending = get().pendingDepreciationPeriods(throughPeriod);
    const ran: string[] = [];
    let total = 0;
    for (const p of pending) {
      const { total: t } = get().previewRun(p);
      const res = get().runDepreciation(p);
      if (res.ok) { ran.push(p); total = round2(total + t); }
    }
    if (ran.length) audit(`caught up ${ran.length} month(s) of depreciation — ${total.toLocaleString()}`, "accounting/fixed-assets/depreciation/catch-up");
    return { ran, total };
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
