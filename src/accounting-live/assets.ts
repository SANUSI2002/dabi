import { create } from "zustand";
import { monthlyDepreciation, netBookValue, useFixedAssets } from "@/store/accounting/useFixedAssets";
import { useBudgets } from "@/store/accounting/useBudgets";
import { useTax } from "@/store/accounting/useTax";
import { useForecast } from "@/store/accounting/useForecast";
import { useLedger } from "@/store/accounting/useLedger";
import { accountingRequest } from "@/emr-live/client";
import type { AssetRevaluation, DepreciationRun, FixedAsset } from "@/data/accounting/fixedAssets";
import type { Budget, CostCentre } from "@/data/accounting/budgets";
import type { TaxReturnSchedule } from "@/data/accounting/tax";
import type { ForecastScenario } from "@/data/accounting/forecast";
import type { TaxReturn } from "@/data/accounting/tax";
import { adoptLiveIdentity, liveChange, uuid } from "@/workforce-live/sync";
import { loadLedger } from "./ledger";

// Fixed assets, budgets and tax returns in live mode (GET /fixed-assets, GET /planning). Every posting —
// capitalisation, depreciation, revaluation, disposal, tax remittance — goes through the server's ledger.
// Tax filing: there is no direct e-filing link to the authorities, so a filing is recorded with the
// acknowledgement the authority's own portal issued.

type Versioned = { version?: number };
type ApiAssets = { assets: (FixedAsset & Versioned)[]; runs: DepreciationRun[]; revaluations: AssetRevaluation[] };
type ApiPlanning = { costCentres: (CostCentre & Versioned)[]; budgets: (Budget & Versioned)[]; taxReturns: (TaxReturn & Versioned)[]; forecasts: (ForecastScenario & Versioned)[] };

// the store's own month edit, kept before live mode replaces it (shows the figure; the server keeps it)
const SHOW_OVERRIDE = useForecast.getState().setOverride;

export const useLiveAssetsMeta = create<{ loaded: boolean; planningLoaded: boolean }>(() => ({ loaded: false, planningLoaded: false }));
const noNull = <T extends object>(row: T) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && v !== undefined)) as T;

export async function loadAssets() {
  const { data } = await accountingRequest<{ data: ApiAssets }>("/fixed-assets");
  useLiveAssetsMeta.setState({ loaded: true });
  useFixedAssets.setState({ assets: data.assets.map((a) => noNull(a)), runs: data.runs.map((r) => noNull(r)), revaluations: data.revaluations.map((r) => noNull(r)) });
  adoptLiveIdentity(null);
}
export async function loadPlanning() {
  const { data } = await accountingRequest<{ data: ApiPlanning }>("/planning");
  useLiveAssetsMeta.setState({ planningLoaded: true });
  useBudgets.setState({ costCentres: data.costCentres, budgets: data.budgets.map((b) => noNull(b)) });
  useTax.setState({ returns: data.taxReturns.map((r) => noNull(r)) });
  useForecast.setState({ scenarios: data.forecasts });
  adoptLiveIdentity(null);
}

const reloadAssets = async () => { await Promise.all([loadAssets(), loadLedger()]); };
const reloadPlanning = async () => { await Promise.all([loadPlanning(), loadLedger()]); };
const FA = () => useFixedAssets.getState();
const post = (path: string, body: unknown = {}) => accountingRequest(path, { method: "POST", body });
const defined = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const locked = (date: string) => useLedger.getState().isDateLocked(date);

/** What a catch-up will charge: each month in turn, on the balances the month before leaves. */
function simulateCatchUp(periods: string[]) {
  let assets = FA().assets.map((a) => ({ ...a }));
  let total = 0;
  for (const p of periods) {
    assets = assets.map((a) => {
      if (a.status !== "Active" || (a.lastDepreciatedPeriod && a.lastDepreciatedPeriod >= p)) return a;
      const charge = monthlyDepreciation(a);
      if (charge <= 0) return a;
      total = round2(total + charge);
      const accumulatedDepreciation = round2(a.accumulatedDepreciation + charge);
      return { ...a, accumulatedDepreciation, lastDepreciatedPeriod: p, status: accumulatedDepreciation >= a.cost - a.salvageValue - 0.01 ? "Fully Depreciated" as const : a.status };
    });
  }
  return total;
}

export function goLiveAssets() {
  useFixedAssets.setState({
    addAsset: (input) => {
      const id = uuid();
      void liveChange(() => post("/fixed-assets", defined({ id, ...input, reducingRateAnnual: input.method === "Reducing Balance" ? input.reducingRateAnnual : undefined, fundedFromAccount: input.sourceBillId ? undefined : input.fundedFromAccount })), reloadAssets);
      return id;
    },
    startConstruction: (input) => { const id = uuid(); void liveChange(() => post("/fixed-assets/construction", { id, ...input }), reloadAssets); return id; },
    addCwipCost: (id, input) => {
      if (FA().assetById(id)?.status !== "Under Construction") return { ok: false, error: "Not a construction-in-progress asset." };
      if (locked(input.date).locked) return { ok: false, error: locked(input.date).reason };
      void liveChange(() => post(`/fixed-assets/${id}/construction-costs`, input), reloadAssets);
      return { ok: true };
    },
    capitaliseCwip: (id, input) => {
      const a = FA().assetById(id);
      if (a?.status !== "Under Construction") return { ok: false, error: "Not a construction-in-progress asset." };
      if (!((a.cwipSpend ?? 0) > 0)) return { ok: false, error: "No costs accumulated yet." };
      void liveChange(() => post(`/fixed-assets/${id}/capitalise`, defined({ ...input, reducingRateAnnual: input.method === "Reducing Balance" ? input.reducingRateAnnual : undefined })), reloadAssets);
      return { ok: true };
    },
    revalueAsset: (id, input) => {
      const a = FA().assetById(id);
      if (!a) return { ok: false, error: "Asset not found." };
      if (a.status === "Disposed" || a.status === "Under Construction") return { ok: false, error: "Can't revalue this asset." };
      if (Math.abs(input.newCarryingValue - netBookValue(a)) < 0.005) return { ok: false, error: "New value matches the current carrying amount." };
      void liveChange(() => post(`/fixed-assets/${id}/revalue`, defined({ ...input })), reloadAssets);
      return { ok: true };
    },
    // Retiring writes off an asset that is carried at nothing; anything still carried is disposed instead.
    retireAsset: (id) => { void liveChange(() => post(`/fixed-assets/${id}/retire`), reloadAssets); },
    runDepreciation: (period) => {
      if (FA().runs.some((r) => r.period === period)) return { ok: false, error: `Depreciation for ${period} has already been run.` };
      if (!FA().previewRun(period).entries.length) return { ok: false, error: "Nothing to depreciate for that period." };
      void liveChange(() => post("/fixed-assets/depreciation/run", { period }), reloadAssets);
      return { ok: true };
    },
    catchUpDepreciation: (throughPeriod) => {
      const ran = FA().pendingDepreciationPeriods(throughPeriod);
      if (!ran.length) return { ran, total: 0 };
      const total = simulateCatchUp(ran);
      void liveChange(() => post("/fixed-assets/depreciation/catch-up", defined({ through: throughPeriod ?? ym(new Date()) })), reloadAssets);
      return { ran, total };
    },
    disposeAsset: (id, input) => {
      const a = FA().assetById(id);
      if (!a) return { ok: false, error: "Asset not found." };
      if (a.status === "Disposed") return { ok: false, error: "Already disposed." };
      if (locked(input.date).locked) return { ok: false, error: locked(input.date).reason };
      void liveChange(() => post(`/fixed-assets/${id}/dispose`, input), reloadAssets);
      return { ok: true };
    },
  });

  const B = () => useBudgets.getState();
  useBudgets.setState({
    addCostCentre: (code, name) => { void liveChange(() => post("/planning/cost-centres", { id: uuid(), code, name }), reloadPlanning); },
    toggleCostCentre: (id) => {
      const c = B().costCentres.find((x) => x.id === id) as (CostCentre & Versioned) | undefined;
      if (!c) return;
      void liveChange(() => accountingRequest(`/planning/cost-centres/${id}`, { method: "PATCH", body: { active: !c.active }, version: c.version ?? 1 }), reloadPlanning,
        () => useBudgets.setState((s) => ({ costCentres: s.costCentres.map((x) => (x.id === id ? { ...x, active: !x.active } : x)) })));
    },
    createBudget: (name, fiscalYear, opts) => {
      const id = uuid();
      void liveChange(() => post("/planning/budgets", defined({ id, name, fiscalYear, copyFromId: opts?.copyFromId, adjustPct: opts?.adjustPct || undefined })), reloadPlanning);
      return id;
    },
    setBudgetStatus: (id, status) => { void liveChange(() => post(`/planning/budgets/${id}/status`, { status }), reloadPlanning); },
    upsertLine: (budgetId, line) => {
      const id = line.id ?? `bl-${uuid().slice(0, 8)}`;
      const saved = { ...line, id };
      void liveChange(() => post(`/planning/budgets/${budgetId}/lines`, defined({ id, accountNumber: line.accountNumber, costCentreId: line.costCentreId, monthly: line.monthly })), reloadPlanning,
        () => useBudgets.setState((s) => ({ budgets: s.budgets.map((b) => (b.id !== budgetId ? b : { ...b, lines: b.lines.some((l) => l.id === id) ? b.lines.map((l) => (l.id === id ? saved : l)) : [...b.lines, saved] })) })));
    },
    removeLine: (budgetId, lineId) => {
      void liveChange(() => post(`/planning/budgets/${budgetId}/lines/${lineId}/remove`), reloadPlanning,
        () => useBudgets.setState((s) => ({ budgets: s.budgets.map((b) => (b.id === budgetId ? { ...b, lines: b.lines.filter((l) => l.id !== lineId) } : b)) })));
    },
  });

  // Forecast scenarios are the organization's own (GET /planning). A month set by hand is saved a moment
  // after typing stops, as the scenario's lines against the version read when sending.
  const FC = () => useForecast.getState();
  const versionOfScenario = (id: string) => (FC().scenarioById(id) as (ForecastScenario & Versioned) | undefined)?.version ?? 1;
  const linesBody = (sc: ForecastScenario) => sc.lines.map((l) => defined({ id: l.id, accountNumber: l.accountNumber, baseAmount: l.baseAmount, monthlyGrowthPct: l.monthlyGrowthPct, overrides: l.overrides }));
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const saveLines = (id: string) => {
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(() => {
      timers.delete(id);
      const sc = FC().scenarioById(id);
      if (sc) void liveChange(() => accountingRequest(`/planning/forecasts/${id}`, { method: "PATCH", version: versionOfScenario(id), body: { lines: linesBody(sc) } }), reloadPlanning);
    }, 600));
  };
  useForecast.setState({
    addScenario: (input) => {
      const id = uuid();
      const lines = input.lines.map((l, i) => ({ ...l, id: `fl-${i}-${id.slice(0, 6)}` }));
      void liveChange(() => post("/planning/forecasts", { id, name: input.name, basis: input.basis, startPeriod: input.startPeriod, months: input.months, lines: lines.map((l) => defined({ ...l })) }), reloadPlanning,
        () => useForecast.setState((s) => ({ scenarios: [{ id, name: input.name, basis: input.basis, startPeriod: input.startPeriod, months: input.months, lines, createdAt: new Date().toISOString(), createdBy: "" }, ...s.scenarios] })));
      return id;
    },
    updateScenario: (id, patch) => {
      void liveChange(() => accountingRequest(`/planning/forecasts/${id}`, { method: "PATCH", version: versionOfScenario(id), body: defined({ name: patch.name, months: patch.months }) }), reloadPlanning,
        () => useForecast.setState((s) => ({ scenarios: s.scenarios.map((x) => (x.id === id ? { ...x, ...patch } : x)) })));
    },
    removeScenario: (id) => {
      void liveChange(() => post(`/planning/forecasts/${id}/remove`), reloadPlanning, () => useForecast.setState((s) => ({ scenarios: s.scenarios.filter((x) => x.id !== id) })));
    },
    setOverride: (scenarioId, lineId, monthIndex, value) => {
      SHOW_OVERRIDE(scenarioId, lineId, monthIndex, value); // shown at once
      saveLines(scenarioId);
    },
  });

  useTax.setState({
    prepareReturn: (returnType, periodStart, periodEnd) => {
      const id = uuid();
      void liveChange(() => post("/planning/tax-returns", { id, returnType, periodStart, periodEnd }), reloadPlanning);
      // shown until the server's figures arrive with the reload
      return { id, reference: `${returnType}-${ym(new Date(periodEnd))}`, kind: returnType === "WHT" ? "WHT" : "VAT", returnType, authority: returnType === "PAYE" ? "State IRS" : "FIRS",
        liabilityAccount: returnType === "VAT" ? 2200 : returnType === "WHT" ? 2210 : 2300, periodStart, periodEnd, outputTax: 0, inputTax: 0, netPayable: 0, status: "Open" };
    },
    efileReturn: (id, ack) => {
      const r = useTax.getState().returns.find((x) => x.id === id);
      if (!r || r.status !== "Open") return { ok: false };
      if (!ack) return { ok: false, needsAcknowledgement: true }; // no direct e-filing link: record the portal's acknowledgement
      void liveChange(() => post(`/planning/tax-returns/${id}/filing`, { submissionRef: ack }), reloadPlanning);
      return { ok: true, ref: ack };
    },
    payReturn: (id, fromAccount) => { void liveChange(() => post(`/planning/tax-returns/${id}/pay`, { fromAccount }), reloadPlanning); },
    returnSchedule: async (id) => (await accountingRequest<{ data: TaxReturnSchedule }>(`/planning/tax-returns/${id}/schedule`)).data,
  });
}

export function clearAssets() {
  useLiveAssetsMeta.setState({ loaded: false });
  useFixedAssets.setState({ assets: [], runs: [], revaluations: [] });
}
export function clearPlanning() {
  useLiveAssetsMeta.setState({ planningLoaded: false });
  useBudgets.setState({ budgets: [], costCentres: [] });
  useForecast.setState({ scenarios: [] });
  useTax.setState({ returns: [] });
}
