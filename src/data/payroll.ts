// Lightweight payroll — salary structure, payslip runs, contracts, loans/advances,
// reimbursements. Deliberately not a tax/GL engine: net pay is computed from a
// simple allowance/deduction list per employee. This is the natural seam where a
// future Accounting module would plug in (confirmed payslips -> ledger export).

const day = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

export type PayComponent = { name: string; amount: number };

export type SalaryStructure = {
  id: string;
  employeeId: string;
  basicSalary: number;
  allowances: PayComponent[];
  deductions: PayComponent[];
  effectiveFrom: string;
};

export type PayslipStatus = "Draft" | "Review Ongoing" | "Confirmed" | "Paid";
export type Payslip = {
  id: string;
  employeeId: string;
  batch: string;
  startDate: string;
  endDate: string;
  basicSalary: number;
  allowances: PayComponent[];
  deductions: PayComponent[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  status: PayslipStatus;
  confirmedAt?: string;
  paidAt?: string;
};

export type ContractStatus = "Active" | "Expired" | "Terminated";
export type Contract = {
  id: string;
  employeeId: string;
  title: string;
  startDate: string;
  endDate?: string;
  basicSalary: number;
  status: ContractStatus;
};

/** master-data "loan-types" label (configurable) */
export type LoanType = string;
export type LoanStatus = "Requested" | "Approved" | "Rejected" | "Repaying" | "Overdue" | "Settled";
export type RepaymentMethod = "Manual" | "Salary Auto-Debit";
export type Loan = {
  id: string;
  employeeId: string;
  type: LoanType;
  amount: number;
  installments: number;
  installmentAmount: number;
  installmentsPaid: number; // count of fully-settled periods
  requestedDate: string;
  status: LoanStatus;
  reason: string;
  repaymentMethod: RepaymentMethod;
  currentPeriodDue: number; // installmentAmount + any shortfall carried from a missed period
  currentPeriodPaid: number;
  periodStartDate?: string; // when the current collection window opened
  missedPeriods: number; // drives escalation severity
  totalPaid: number;
};

export type LoanPayment = {
  id: string;
  loanId: string;
  amount: number;
  date: string;
};

export type EscalationLetter = {
  id: string;
  loanId: string;
  level: 1 | 2;
  issuedDate: string;
  amountOwed: number;
  sent: boolean;
  sentAt?: string;
};

export type LoanEligibilityTier = {
  id: string;
  minMonthlySalary: number;
  maxMonthlySalary: number | null; // null = no upper bound
  maxLoanAmount: number;
};

export type ReimbursementType = "Expense Claim" | "Leave Encashment";
export type ReimbursementStatus = "Requested" | "Approved" | "Rejected" | "Paid";
export type Reimbursement = {
  id: string;
  employeeId: string;
  type: ReimbursementType;
  title: string;
  amount: number;
  requestedDate: string;
  status: ReimbursementStatus;
};

const BASIC: Record<string, number> = {
  s1: 450000, s2: 280000, s3: 180000, s4: 150000, s5: 90000, s6: 200000, s7: 160000, s8: 100000,
};
const CLINICAL = new Set(["s1", "s2", "s3", "s7"]);

function buildStructure(employeeId: string): SalaryStructure {
  const basic = BASIC[employeeId] ?? 120000;
  const allowances: PayComponent[] = [
    { name: "Housing", amount: Math.round(basic * 0.2) },
    { name: "Transport", amount: Math.round(basic * 0.1) },
  ];
  if (CLINICAL.has(employeeId)) allowances.push({ name: "Clinical / Hazard", amount: Math.round(basic * 0.15) });
  const deductions: PayComponent[] = [
    { name: "Pension (8%)", amount: Math.round(basic * 0.08) },
    { name: "PAYE Tax", amount: Math.round(basic * 0.07) },
  ];
  return { id: `ss-${employeeId}`, employeeId, basicSalary: basic, allowances, deductions, effectiveFrom: day(400) };
}

export const salaryStructures: SalaryStructure[] = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"].map(buildStructure);

function buildPayslip(employeeId: string, batch: string, startDate: string, endDate: string, status: PayslipStatus): Payslip {
  const s = salaryStructures.find((x) => x.employeeId === employeeId)!;
  const gross = s.basicSalary + s.allowances.reduce((n, a) => n + a.amount, 0);
  const totalDeductions = s.deductions.reduce((n, d) => n + d.amount, 0);
  return {
    id: `ps-${employeeId}-${batch}`, employeeId, batch, startDate, endDate,
    basicSalary: s.basicSalary, allowances: s.allowances, deductions: s.deductions,
    grossPay: gross, totalDeductions, netPay: gross - totalDeductions, status,
  };
}

export const payslips: Payslip[] = [
  buildPayslip("s1", "August 2026", day(60), day(33), "Paid"),
  buildPayslip("s2", "August 2026", day(60), day(33), "Paid"),
  buildPayslip("s3", "August 2026", day(60), day(33), "Paid"),
  buildPayslip("s4", "August 2026", day(60), day(33), "Paid"),
  buildPayslip("s5", "August 2026", day(60), day(33), "Paid"),
  buildPayslip("s6", "August 2026", day(60), day(33), "Paid"),
  buildPayslip("s7", "August 2026", day(60), day(33), "Paid"),
  buildPayslip("s8", "August 2026", day(60), day(33), "Paid"),
].map((p) => ({ ...p, confirmedAt: day(35), paidAt: day(32) }));

export const contracts: Contract[] = [
  { id: "ct1", employeeId: "s5", title: "1-Year Fixed Term — Community Health Worker", startDate: day(300), endDate: day(-65), basicSalary: BASIC.s5, status: "Active" },
  { id: "ct2", employeeId: "s7", title: "3-Month Locum Cover — Lab Technician", startDate: day(200), endDate: day(-100), basicSalary: BASIC.s7, status: "Active" },
];

export const loans: Loan[] = [
  {
    id: "ln1", employeeId: "s8", type: "Salary Advance", amount: 50000, installments: 2, installmentAmount: 25000,
    installmentsPaid: 1, requestedDate: day(40), status: "Repaying", reason: "Rent shortfall this month",
    repaymentMethod: "Manual", currentPeriodDue: 25000, currentPeriodPaid: 0, periodStartDate: day(10), missedPeriods: 0, totalPaid: 25000,
  },
];

export const loanPayments: LoanPayment[] = [
  { id: "lp1", loanId: "ln1", amount: 25000, date: day(38) },
];

export const escalationLetters: EscalationLetter[] = [];

export const loanEligibilityTiers: LoanEligibilityTier[] = [
  { id: "tier1", minMonthlySalary: 0, maxMonthlySalary: 150000, maxLoanAmount: 300000 },
  { id: "tier2", minMonthlySalary: 150001, maxMonthlySalary: 300000, maxLoanAmount: 800000 },
  { id: "tier3", minMonthlySalary: 300001, maxMonthlySalary: null, maxLoanAmount: 2000000 },
];

export const reimbursements: Reimbursement[] = [
  { id: "rb1", employeeId: "s6", type: "Expense Claim", title: "Data bundle for NHMIS upload — August", amount: 8000, requestedDate: day(10), status: "Requested" },
];
