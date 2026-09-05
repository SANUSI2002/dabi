import { create } from "zustand";
import { differenceInCalendarDays } from "date-fns";
import * as seed from "@/data/payroll";
import { audit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import type {
  SalaryStructure, Payslip, PayslipStatus, PayComponent, Contract, Loan, LoanType, RepaymentMethod,
  LoanPayment, EscalationLetter, LoanEligibilityTier, Reimbursement, ReimbursementType,
} from "@/data/payroll";

const rid = () => Math.random().toString(36).slice(2, 9);
const who = (id: string) => useHr.getState().byId(id)?.name ?? id;
const PERIOD_DAYS = 30;

const NEXT_STATUS: Record<PayslipStatus, PayslipStatus | null> = {
  Draft: "Review Ongoing", "Review Ongoing": "Confirmed", Confirmed: "Paid", Paid: null,
};

type PayrollState = {
  salaryStructures: SalaryStructure[];
  payslips: Payslip[];
  contracts: Contract[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  escalationLetters: EscalationLetter[];
  loanEligibilityTiers: LoanEligibilityTier[];
  reimbursements: Reimbursement[];

  structureFor: (employeeId: string) => SalaryStructure | undefined;
  setStructure: (employeeId: string, basicSalary: number, allowances: PayComponent[], deductions: PayComponent[]) => void;

  runBatch: (batch: string, startDate: string, endDate: string, employeeIds: string[]) => void;
  advancePayslip: (id: string) => void;
  confirmBatch: (batch: string) => void;

  addContract: (c: Omit<Contract, "id" | "status">) => void;

  requestLoan: (employeeId: string, type: LoanType, amount: number, installments: number, reason: string, repaymentMethod: RepaymentMethod) => void;
  decideLoan: (id: string, status: "Approved" | "Rejected") => void;
  recordPayment: (loanId: string, amount: number, date: string) => void;
  checkOverdue: (loanId: string) => void;
  sendEscalationLetter: (id: string) => void;
  paymentsFor: (loanId: string) => LoanPayment[];
  lettersFor: (loanId: string) => EscalationLetter[];
  requiresEscalation: (loan: Loan) => boolean;
  maxLoanFor: (employeeId: string) => number | null;
  addEligibilityTier: (t: Omit<LoanEligibilityTier, "id">) => void;

  requestReimbursement: (employeeId: string, type: ReimbursementType, title: string, amount: number) => void;
  decideReimbursement: (id: string, status: "Approved" | "Rejected" | "Paid") => void;
};

export const usePayroll = create<PayrollState>((set, get) => ({
  salaryStructures: seed.salaryStructures,
  payslips: seed.payslips,
  contracts: seed.contracts,
  loans: seed.loans,
  loanPayments: seed.loanPayments,
  escalationLetters: seed.escalationLetters,
  loanEligibilityTiers: seed.loanEligibilityTiers,
  reimbursements: seed.reimbursements,

  structureFor: (employeeId) => get().salaryStructures.find((s) => s.employeeId === employeeId),

  setStructure: (employeeId, basicSalary, allowances, deductions) => {
    audit("updated salary structure", `hr/payroll/structure/${who(employeeId)}`);
    set((s) => {
      const exists = s.salaryStructures.some((x) => x.employeeId === employeeId);
      const row: SalaryStructure = { id: `ss-${employeeId}`, employeeId, basicSalary, allowances, deductions, effectiveFrom: new Date().toISOString() };
      return { salaryStructures: exists ? s.salaryStructures.map((x) => (x.employeeId === employeeId ? row : x)) : [row, ...s.salaryStructures] };
    });
  },

  runBatch: (batch, startDate, endDate, employeeIds) => {
    audit("ran payroll batch", `hr/payroll/batch/${batch}`);
    const structures = get().salaryStructures;
    const newPayslips: Payslip[] = employeeIds.map((employeeId) => {
      const s = structures.find((x) => x.employeeId === employeeId);
      const basic = s?.basicSalary ?? 0;
      const allowances = s?.allowances ?? [];
      const deductions = [...(s?.deductions ?? [])];

      const autoDebitLoan = get().loans.find((l) => l.employeeId === employeeId && l.status === "Repaying" && l.repaymentMethod === "Salary Auto-Debit");
      if (autoDebitLoan) deductions.push({ name: "Loan repayment (auto-debit)", amount: autoDebitLoan.currentPeriodDue });

      const gross = basic + allowances.reduce((n, a) => n + a.amount, 0);
      const totalDeductions = deductions.reduce((n, d) => n + d.amount, 0);
      return {
        id: rid(), employeeId, batch, startDate, endDate, basicSalary: basic, allowances, deductions,
        grossPay: gross, totalDeductions, netPay: gross - totalDeductions, status: "Draft",
      };
    });
    set((s) => ({ payslips: [...newPayslips, ...s.payslips] }));

    // auto-debit loans are settled the moment their payroll batch runs, not on manual confirmation
    employeeIds.forEach((employeeId) => {
      const loan = get().loans.find((l) => l.employeeId === employeeId && l.status === "Repaying" && l.repaymentMethod === "Salary Auto-Debit");
      if (loan) get().recordPayment(loan.id, loan.currentPeriodDue, startDate);
    });
  },

  advancePayslip: (id) => {
    const p = get().payslips.find((x) => x.id === id);
    if (!p) return;
    const next = NEXT_STATUS[p.status];
    if (!next) return;
    audit(`payslip ${next.toLowerCase()}`, `hr/payroll/payslip/${who(p.employeeId)}`);
    const now = new Date().toISOString();
    set((s) => ({
      payslips: s.payslips.map((x) =>
        x.id === id ? { ...x, status: next, confirmedAt: next === "Confirmed" ? now : x.confirmedAt, paidAt: next === "Paid" ? now : x.paidAt } : x,
      ),
    }));
  },

  confirmBatch: (batch) => {
    audit("confirmed payroll batch", `hr/payroll/batch/${batch}`);
    const now = new Date().toISOString();
    set((s) => ({
      payslips: s.payslips.map((p) =>
        p.batch === batch && p.status === "Review Ongoing" ? { ...p, status: "Confirmed", confirmedAt: now } : p,
      ),
    }));
  },

  addContract: (c) => {
    audit("added contract", `hr/payroll/contract/${who(c.employeeId)}`);
    set((s) => ({ contracts: [{ ...c, id: rid(), status: "Active" }, ...s.contracts] }));
  },

  requestLoan: (employeeId, type, amount, installments, reason, repaymentMethod) => {
    audit(`requested ${type.toLowerCase()}`, `hr/payroll/loan/${who(employeeId)}`);
    const installmentAmount = Math.round(amount / installments);
    set((s) => ({
      loans: [
        {
          id: rid(), employeeId, type, amount, installments, installmentAmount, installmentsPaid: 0,
          requestedDate: new Date().toISOString(), status: "Requested", reason, repaymentMethod,
          currentPeriodDue: installmentAmount, currentPeriodPaid: 0, missedPeriods: 0, totalPaid: 0,
        },
        ...s.loans,
      ],
    }));
  },

  decideLoan: (id, status) => {
    const l = get().loans.find((x) => x.id === id);
    audit(`loan ${status.toLowerCase()}`, `hr/payroll/loan/${l ? who(l.employeeId) : id}`);
    const now = new Date().toISOString();
    set((s) => ({
      loans: s.loans.map((x) =>
        x.id === id ? { ...x, status: status === "Approved" ? "Repaying" : "Rejected", periodStartDate: status === "Approved" ? now : x.periodStartDate } : x,
      ),
    }));
  },

  recordPayment: (loanId, amount, date) => {
    const l = get().loans.find((x) => x.id === loanId);
    if (!l) return;
    audit("recorded loan payment", `hr/payroll/loan/${who(l.employeeId)}`, { user: who(l.employeeId) });
    set((s) => ({ loanPayments: [{ id: rid(), loanId, amount, date }, ...s.loanPayments] }));

    const paidThisPeriod = l.currentPeriodPaid + amount;
    const totalPaid = l.totalPaid + amount;
    if (paidThisPeriod >= l.currentPeriodDue) {
      const installmentsPaid = l.installmentsPaid + 1;
      const settled = installmentsPaid >= l.installments;
      set((s) => ({
        loans: s.loans.map((x) =>
          x.id === loanId
            ? {
                ...x,
                installmentsPaid,
                totalPaid,
                status: settled ? "Settled" : "Repaying",
                currentPeriodDue: settled ? 0 : x.installmentAmount,
                currentPeriodPaid: 0,
                periodStartDate: settled ? x.periodStartDate : date,
              }
            : x,
        ),
      }));
    } else {
      set((s) => ({
        loans: s.loans.map((x) => (x.id === loanId ? { ...x, currentPeriodPaid: paidThisPeriod, totalPaid } : x)),
      }));
    }
  },

  checkOverdue: (loanId) => {
    const l = get().loans.find((x) => x.id === loanId);
    if (!l || (l.status !== "Repaying" && l.status !== "Overdue") || l.repaymentMethod !== "Manual" || !l.periodStartDate) return;
    const daysElapsed = differenceInCalendarDays(new Date(), new Date(l.periodStartDate));
    if (daysElapsed < PERIOD_DAYS || l.currentPeriodPaid >= l.currentPeriodDue) return;

    const shortfall = l.currentPeriodDue - l.currentPeriodPaid;
    const missedPeriods = l.missedPeriods + 1;
    audit("flagged loan overdue", `hr/payroll/loan/${who(l.employeeId)}`);
    set((s) => ({
      loans: s.loans.map((x) =>
        x.id === loanId
          ? { ...x, status: "Overdue", missedPeriods, currentPeriodDue: x.installmentAmount + shortfall, currentPeriodPaid: 0, periodStartDate: new Date().toISOString() }
          : x,
      ),
    }));

    if (get().requiresEscalation(l)) {
      const level = Math.min(missedPeriods, 2) as 1 | 2;
      audit(`generated level ${level} escalation letter`, `hr/payroll/loan/${who(l.employeeId)}`);
      set((s) => ({
        escalationLetters: [
          {
            id: rid(), loanId, level, issuedDate: new Date().toISOString(),
            amountOwed: shortfall, sent: false,
          },
          ...s.escalationLetters,
        ],
      }));
    }
  },

  sendEscalationLetter: (id) => {
    const letter = get().escalationLetters.find((x) => x.id === id);
    audit("sent escalation letter", `hr/payroll/loan/${letter?.loanId ?? id}`);
    set((s) => ({
      escalationLetters: s.escalationLetters.map((x) => (x.id === id ? { ...x, sent: true, sentAt: new Date().toISOString() } : x)),
    }));
  },

  paymentsFor: (loanId) => get().loanPayments.filter((p) => p.loanId === loanId),
  lettersFor: (loanId) => get().escalationLetters.filter((l) => l.loanId === loanId),

  requiresEscalation: (loan) => {
    const structure = get().structureFor(loan.employeeId);
    const annualSalary = (structure?.basicSalary ?? 0) * 12;
    return loan.amount > annualSalary;
  },

  maxLoanFor: (employeeId) => {
    const structure = get().structureFor(employeeId);
    if (!structure) return null;
    const tier = get().loanEligibilityTiers.find(
      (t) => structure.basicSalary >= t.minMonthlySalary && (t.maxMonthlySalary === null || structure.basicSalary <= t.maxMonthlySalary),
    );
    return tier?.maxLoanAmount ?? null;
  },

  addEligibilityTier: (t) => {
    audit("added loan eligibility tier", "hr/payroll/loan-tier");
    set((s) => ({ loanEligibilityTiers: [...s.loanEligibilityTiers, { ...t, id: rid() }].sort((a, b) => a.minMonthlySalary - b.minMonthlySalary) }));
  },

  requestReimbursement: (employeeId, type, title, amount) => {
    audit(`requested ${type.toLowerCase()}`, `hr/payroll/reimbursement/${who(employeeId)}`);
    set((s) => ({
      reimbursements: [{ id: rid(), employeeId, type, title, amount, requestedDate: new Date().toISOString(), status: "Requested" }, ...s.reimbursements],
    }));
  },

  decideReimbursement: (id, status) => {
    const r = get().reimbursements.find((x) => x.id === id);
    audit(`reimbursement ${status.toLowerCase()}`, `hr/payroll/reimbursement/${r ? who(r.employeeId) : id}`);
    set((s) => ({ reimbursements: s.reimbursements.map((x) => (x.id === id ? { ...x, status } : x)) }));
  },
}));
