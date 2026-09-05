// Budgets & Cost Centres.
// Reference: Budget model + BudgetService.getBudgetComparison(start,end) which
// nets budgeted vs actual per account. Sabi models an annual budget broken into
// 12 monthly figures per account, optionally tagged to a cost centre, plus a
// Budget vs Actual view that pulls actuals straight from posted journal lines.

export type CostCentre = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

export type BudgetLine = {
  id: string;
  accountNumber: number;
  costCentreId?: string;
  monthly: number[]; // length 12, Jan..Dec
};

export type Budget = {
  id: string;
  name: string;
  fiscalYear: number;
  status: "Draft" | "Active" | "Closed";
  lines: BudgetLine[];
  createdAt: string;
};

export const seedCostCentres: CostCentre[] = [
  { id: "cc-opd", code: "OPD", name: "Outpatient Department", active: true },
  { id: "cc-lab", code: "LAB", name: "Laboratory", active: true },
  { id: "cc-pharm", code: "PHM", name: "Pharmacy", active: true },
  { id: "cc-mch", code: "MCH", name: "Maternal & Child Health", active: true },
  { id: "cc-admin", code: "ADM", name: "Administration & Facilities", active: true },
];

const flat = (annual: number) => Array.from({ length: 12 }, () => Math.round(annual / 12));

export const seedBudgets: Budget[] = [
  {
    id: "bud-2026",
    name: "FY2026 Operating Budget",
    fiscalYear: 2026,
    status: "Active",
    createdAt: "2025-12-15T00:00:00.000Z",
    lines: [
      { id: "bl-1", accountNumber: 4000, costCentreId: "cc-opd", monthly: flat(18_000_000) },
      { id: "bl-2", accountNumber: 4010, costCentreId: "cc-lab", monthly: flat(9_600_000) },
      { id: "bl-3", accountNumber: 4020, costCentreId: "cc-pharm", monthly: flat(14_400_000) },
      { id: "bl-4", accountNumber: 5000, costCentreId: "cc-pharm", monthly: flat(9_000_000) },
      { id: "bl-5", accountNumber: 5100, costCentreId: "cc-admin", monthly: flat(15_600_000) },
      { id: "bl-6", accountNumber: 5200, costCentreId: "cc-admin", monthly: flat(4_800_000) },
      { id: "bl-7", accountNumber: 5210, costCentreId: "cc-admin", monthly: flat(3_600_000) },
      { id: "bl-8", accountNumber: 5220, costCentreId: "cc-admin", monthly: flat(2_400_000) },
    ],
  },
];
