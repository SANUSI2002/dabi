// B11 — driver-based financial forecasting. A scenario projects revenue and
// expense accounts forward from a base figure with a monthly growth rate (or a
// manual override per month), then compares the projection to actuals as
// months close (ForecastComparison).

export type ForecastBasis = "Last 3 months average" | "Budget" | "Manual base";

export type ForecastLine = {
  id: string;
  accountNumber: number;
  baseAmount: number; // month-0 figure
  monthlyGrowthPct: number; // compounding
  overrides?: (number | null)[]; // per-month manual figure; null = use the model
};

export type ForecastScenario = {
  id: string;
  name: string;
  basis: ForecastBasis;
  startPeriod: string; // YYYY-MM
  months: number;
  lines: ForecastLine[];
  createdAt: string;
  createdBy: string;
};

export const seedForecastScenarios: ForecastScenario[] = [
  {
    id: "fc-base", name: "FY2026 H2 — base case", basis: "Last 3 months average", startPeriod: "2026-07",
    months: 6, createdAt: "2026-06-20T00:00:00.000Z", createdBy: "s1",
    lines: [
      { id: "fl-1", accountNumber: 4000, baseAmount: 1_450_000, monthlyGrowthPct: 3 },
      { id: "fl-2", accountNumber: 4010, baseAmount: 820_000, monthlyGrowthPct: 2 },
      { id: "fl-3", accountNumber: 4020, baseAmount: 1_180_000, monthlyGrowthPct: 2.5 },
      { id: "fl-4", accountNumber: 5000, baseAmount: 760_000, monthlyGrowthPct: 2 },
      { id: "fl-5", accountNumber: 5100, baseAmount: 1_300_000, monthlyGrowthPct: 1.5 },
      { id: "fl-6", accountNumber: 5200, baseAmount: 400_000, monthlyGrowthPct: 0 },
    ],
  },
];
