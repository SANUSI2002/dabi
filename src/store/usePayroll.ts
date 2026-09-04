import { create } from "zustand";
import * as seed from "@/data/payroll";
import { audit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import type { SalaryStructure, Payslip, PayslipStatus, PayComponent, Contract, Loan, LoanType, Reimbursement, ReimbursementType } from "@/data/payroll";

const rid = () => Math.random().toString(36).slice(2, 9);
const who = (id: string) => useHr.getState().byId(id)?.name ?? id;

const NEXT_STATUS: Record<PayslipStatus, PayslipStatus | null> = {
  Draft: "Review Ongoing", "Review Ongoing": "Confirmed", Confirmed: "Paid", Paid: null,
};

type PayrollState = {
  salaryStructures: SalaryStructure[];
  payslips: Payslip[];
  contracts: Contract[];
  loans: Loan[];
  reimbursements: Reimbursement[];

  structureFor: (employeeId: string) => SalaryStructure | undefined;
  setStructure: (employeeId: string, basicSalary: number, allowances: PayComponent[], deductions: PayComponent[]) => void;

  runBatch: (batch: string, startDate: string, endDate: string, employeeIds: string[]) => void;
  advancePayslip: (id: string) => void;
  confirmBatch: (batch: string) => void;

  addContract: (c: Omit<Contract, "id" | "status">) => void;

  requestLoan: (employeeId: string, type: LoanType, amount: number, installments: number, reason: string) => void;
  decideLoan: (id: string, status: "Approved" | "Rejected") => void;
  payInstallment: (id: string) => void;

  requestReimbursement: (employeeId: string, type: ReimbursementType, title: string, amount: number) => void;
  decideReimbursement: (id: string, status: "Approved" | "Rejected" | "Paid") => void;
};

export const usePayroll = create<PayrollState>((set, get) => ({
  salaryStructures: seed.salaryStructures,
  payslips: seed.payslips,
  contracts: seed.contracts,
  loans: seed.loans,
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
      const deductions = s?.deductions ?? [];
      const gross = basic + allowances.reduce((n, a) => n + a.amount, 0);
      const totalDeductions = deductions.reduce((n, d) => n + d.amount, 0);
      return {
        id: rid(), employeeId, batch, startDate, endDate, basicSalary: basic, allowances, deductions,
        grossPay: gross, totalDeductions, netPay: gross - totalDeductions, status: "Draft",
      };
    });
    set((s) => ({ payslips: [...newPayslips, ...s.payslips] }));
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

  requestLoan: (employeeId, type, amount, installments, reason) => {
    audit(`requested ${type.toLowerCase()}`, `hr/payroll/loan/${who(employeeId)}`);
    set((s) => ({
      loans: [
        { id: rid(), employeeId, type, amount, installments, installmentAmount: Math.round(amount / installments), installmentsPaid: 0, requestedDate: new Date().toISOString(), status: "Requested", reason },
        ...s.loans,
      ],
    }));
  },

  decideLoan: (id, status) => {
    const l = get().loans.find((x) => x.id === id);
    audit(`loan ${status.toLowerCase()}`, `hr/payroll/loan/${l ? who(l.employeeId) : id}`);
    set((s) => ({ loans: s.loans.map((x) => (x.id === id ? { ...x, status: status === "Approved" ? "Repaying" : "Rejected" } : x)) }));
  },

  payInstallment: (id) => {
    const l = get().loans.find((x) => x.id === id);
    if (!l) return;
    const paid = l.installmentsPaid + 1;
    audit("recorded loan installment", `hr/payroll/loan/${who(l.employeeId)}`);
    set((s) => ({
      loans: s.loans.map((x) => (x.id === id ? { ...x, installmentsPaid: paid, status: paid >= x.installments ? "Settled" : "Repaying" } : x)),
    }));
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
