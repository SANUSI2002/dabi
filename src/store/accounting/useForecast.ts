import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { useLedger } from "@/store/accounting/useLedger";
import { seedForecastScenarios, type ForecastScenario, type ForecastLine, type ForecastBasis } from "@/data/accounting/forecast";

const rid = () => Math.random().toString(36).slice(2, 9);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const addMonth = (period: string, n: number) => {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export type ForecastCell = { period: string; projected: number; actual: number | null; variance: number | null };
export type ForecastRow = { accountNumber: number; accountName: string; type: string; cells: ForecastCell[]; projectedTotal: number; actualTotal: number };

type ForecastState = {
  scenarios: ForecastScenario[];
  scenarioById: (id: string) => ForecastScenario | undefined;
  addScenario: (input: { name: string; basis: ForecastBasis; startPeriod: string; months: number; lines: Omit<ForecastLine, "id">[] }) => string;
  seedLinesFromLedger: (startPeriod: string) => Omit<ForecastLine, "id">[];
  updateScenario: (id: string, patch: Partial<Pick<ForecastScenario, "name" | "months">>) => void;
  removeScenario: (id: string) => void;
  setOverride: (scenarioId: string, lineId: string, monthIndex: number, value: number | null) => void;
  project: (scenarioId: string) => { rows: ForecastRow[]; periods: string[]; totals: { projected: number; actual: number } };
};

const projectedFor = (line: ForecastLine, monthIndex: number) => {
  const ov = line.overrides?.[monthIndex];
  if (ov !== undefined && ov !== null) return round2(ov);
  return round2(line.baseAmount * Math.pow(1 + line.monthlyGrowthPct / 100, monthIndex));
};

export const useForecast = create<ForecastState>((set, get) => ({
  scenarios: seedForecastScenarios,
  scenarioById: (id) => get().scenarios.find((s) => s.id === id),

  seedLinesFromLedger: (startPeriod) => {
    const led = useLedger.getState();
    const [y, m] = startPeriod.split("-").map(Number);
    const from = new Date(Date.UTC(y, m - 4, 1)).toISOString();
    const to = new Date(Date.UTC(y, m - 1, 0, 23, 59, 59)).toISOString();
    return led.accounts
      .filter((a) => (a.type === "revenue" || a.type === "expense" || a.type === "cogs") && a.isActive)
      .map((a) => ({ accountNumber: a.number, baseAmount: round2(Math.abs(led.activityOf(a.number, from, to)) / 3), monthlyGrowthPct: 0 }))
      .filter((l) => l.baseAmount > 0);
  },

  addScenario: (input) => {
    const id = `fc-${rid()}`;
    set((s) => ({ scenarios: [{ id, name: input.name, basis: input.basis, startPeriod: input.startPeriod, months: input.months, lines: input.lines.map((l) => ({ ...l, id: `fl-${rid()}` })), createdAt: new Date().toISOString(), createdBy: useIdentity.getState().user.id }, ...s.scenarios] }));
    audit(`created forecast scenario ${input.name}`, `accounting/forecast/${input.name}`);
    return id;
  },
  updateScenario: (id, patch) => set((s) => ({ scenarios: s.scenarios.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
  removeScenario: (id) => set((s) => ({ scenarios: s.scenarios.filter((x) => x.id !== id) })),
  setOverride: (scenarioId, lineId, monthIndex, value) =>
    set((s) => ({
      scenarios: s.scenarios.map((sc) => {
        if (sc.id !== scenarioId) return sc;
        return {
          ...sc,
          lines: sc.lines.map((l) => {
            if (l.id !== lineId) return l;
            const overrides = [...(l.overrides ?? Array(sc.months).fill(null))];
            overrides[monthIndex] = value;
            return { ...l, overrides };
          }),
        };
      }),
    })),

  project: (scenarioId) => {
    const sc = get().scenarioById(scenarioId);
    const led = useLedger.getState();
    if (!sc) return { rows: [], periods: [], totals: { projected: 0, actual: 0 } };
    const periods = Array.from({ length: sc.months }, (_, i) => addMonth(sc.startPeriod, i));
    const now = new Date();
    const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    const rows: ForecastRow[] = sc.lines.map((line) => {
      const acct = led.accountByNumber(line.accountNumber);
      const cells: ForecastCell[] = periods.map((period, i) => {
        const projected = projectedFor(line, i);
        let actual: number | null = null;
        if (period <= currentPeriod) {
          const [py, pm] = period.split("-").map(Number);
          const from = new Date(Date.UTC(py, pm - 1, 1)).toISOString();
          const to = new Date(Date.UTC(py, pm, 0, 23, 59, 59)).toISOString();
          actual = round2(Math.abs(led.activityOf(line.accountNumber, from, to)));
        }
        return { period, projected, actual, variance: actual === null ? null : round2(actual - projected) };
      });
      return {
        accountNumber: line.accountNumber,
        accountName: acct?.name ?? String(line.accountNumber),
        type: acct?.type ?? "?",
        cells,
        projectedTotal: round2(cells.reduce((n, c) => n + c.projected, 0)),
        actualTotal: round2(cells.reduce((n, c) => n + (c.actual ?? 0), 0)),
      };
    });
    return {
      rows,
      periods,
      totals: { projected: round2(rows.reduce((n, r) => n + r.projectedTotal, 0)), actual: round2(rows.reduce((n, r) => n + r.actualTotal, 0)) },
    };
  },
}));
