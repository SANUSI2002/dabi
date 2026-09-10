import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useLedger } from "@/store/accounting/useLedger";
import { seedBudgets, seedCostCentres, type Budget, type BudgetLine, type CostCentre } from "@/data/accounting/budgets";

const rid = () => Math.random().toString(36).slice(2, 9);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type BvaRow = {
  accountNumber: number;
  accountName: string;
  type: string;
  costCentreId?: string;
  budgeted: number;
  actual: number;
  variance: number; // actual - budget for revenue (favourable +), budget - actual for expense (favourable +)
  favourable: boolean;
};

type BudgetState = {
  budgets: Budget[];
  costCentres: CostCentre[];

  addCostCentre: (code: string, name: string) => void;
  toggleCostCentre: (id: string) => void;

  budgetById: (id: string) => Budget | undefined;
  createBudget: (name: string, fiscalYear: number, opts?: { copyFromId?: string; adjustPct?: number }) => string;
  setBudgetStatus: (id: string, status: Budget["status"]) => void;
  upsertLine: (budgetId: string, line: Omit<BudgetLine, "id"> & { id?: string }) => void;
  removeLine: (budgetId: string, lineId: string) => void;

  budgetVsActual: (budgetId: string, throughMonth: number) => { rows: BvaRow[]; totals: { budgeted: number; actual: number } };
};

export const useBudgets = create<BudgetState>((set, get) => ({
  budgets: seedBudgets,
  costCentres: seedCostCentres,

  addCostCentre: (code, name) => {
    set((s) => ({ costCentres: [...s.costCentres, { id: `cc-${rid()}`, code, name, active: true }] }));
    audit(`created cost centre ${code} — ${name}`, `accounting/cost-centres/${code}`);
  },
  toggleCostCentre: (id) => set((s) => ({ costCentres: s.costCentres.map((c) => (c.id === id ? { ...c, active: !c.active } : c)) })),

  budgetById: (id) => get().budgets.find((b) => b.id === id),

  createBudget: (name, fiscalYear, opts) => {
    const id = `bud-${rid()}`;
    const src = opts?.copyFromId ? get().budgetById(opts.copyFromId) : undefined;
    const factor = 1 + (opts?.adjustPct ?? 0) / 100;
    const lines: BudgetLine[] = src
      ? src.lines.map((l) => ({ ...l, id: `bl-${rid()}`, monthly: l.monthly.map((v) => Math.round(v * factor)) }))
      : [];
    set((s) => ({ budgets: [{ id, name, fiscalYear, status: "Draft", lines, createdAt: new Date().toISOString() }, ...s.budgets] }));
    audit(`created budget ${name}${src ? ` (from ${src.name}${opts?.adjustPct ? `, ${opts.adjustPct > 0 ? "+" : ""}${opts.adjustPct}%` : ""})` : ""}`, `accounting/budgets/${name}`);
    return id;
  },
  setBudgetStatus: (id, status) => {
    set((s) => {
      // only one Active budget per fiscal year
      const target = s.budgets.find((b) => b.id === id);
      return {
        budgets: s.budgets.map((b) => {
          if (b.id === id) return { ...b, status };
          if (status === "Active" && target && b.fiscalYear === target.fiscalYear && b.status === "Active") return { ...b, status: "Closed" as const };
          return b;
        }),
      };
    });
    audit(`set budget ${status.toLowerCase()}`, `accounting/budgets/${id}`);
  },
  upsertLine: (budgetId, line) =>
    set((s) => ({
      budgets: s.budgets.map((b) => {
        if (b.id !== budgetId) return b;
        if (line.id && b.lines.some((l) => l.id === line.id)) {
          return { ...b, lines: b.lines.map((l) => (l.id === line.id ? { ...l, ...line } as BudgetLine : l)) };
        }
        return { ...b, lines: [...b.lines, { ...line, id: `bl-${rid()}` } as BudgetLine] };
      }),
    })),
  removeLine: (budgetId, lineId) => set((s) => ({ budgets: s.budgets.map((b) => (b.id === budgetId ? { ...b, lines: b.lines.filter((l) => l.id !== lineId) } : b)) })),

  budgetVsActual: (budgetId, throughMonth) => {
    const budget = get().budgetById(budgetId);
    const led = useLedger.getState();
    if (!budget) return { rows: [], totals: { budgeted: 0, actual: 0 } };
    const from = new Date(Date.UTC(budget.fiscalYear, 0, 1)).toISOString();
    const to = new Date(Date.UTC(budget.fiscalYear, throughMonth, 0, 23, 59, 59)).toISOString();

    const rows: BvaRow[] = budget.lines.map((line) => {
      const acct = led.accountByNumber(line.accountNumber);
      const budgeted = round2(line.monthly.slice(0, throughMonth).reduce((n, v) => n + v, 0));
      const actual = round2(Math.abs(led.activityOf(line.accountNumber, from, to)));
      const isRevenue = acct?.type === "revenue";
      const variance = isRevenue ? round2(actual - budgeted) : round2(budgeted - actual);
      return {
        accountNumber: line.accountNumber,
        accountName: acct?.name ?? `${line.accountNumber}`,
        type: acct?.type ?? "?",
        costCentreId: line.costCentreId,
        budgeted,
        actual,
        variance,
        favourable: variance >= 0,
      };
    });
    return {
      rows,
      totals: { budgeted: round2(rows.reduce((n, r) => n + r.budgeted, 0)), actual: round2(rows.reduce((n, r) => n + r.actual, 0)) },
    };
  },
}));
