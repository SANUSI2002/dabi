import { create } from "zustand";
import { usePayroll } from "@/store/usePayroll";
import { workforceRequest } from "@/emr-live/client";
import type { Contract, EscalationLetter, Loan, LoanEligibilityTier, LoanPayment, Payslip, Reimbursement, SalaryStructure } from "@/data/payroll";
import { isoDay, liveChange, uuid } from "./sync";

// Payroll in live mode (GET /payroll, payroll staff only): salary structures, payslips, contracts, loans
// and reimbursements are the organization's records. The server computes every payslip and requires a
// second person to confirm a batch; "Paid" records a payment made outside Sabi — nothing moves money.

type ApiPayroll = {
  salaryStructures: SalaryStructure[]; payslips: Payslip[]; contracts: Contract[]; loans: Loan[]; loanPayments: LoanPayment[];
  escalationLetters: EscalationLetter[]; loanEligibilityTiers: LoanEligibilityTier[]; reimbursements: Reimbursement[];
};

export const useLivePayrollMeta = create<{ loaded: boolean }>(() => ({ loaded: false }));
const noNull = <T extends object>(row: T) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null)) as T;

export async function loadPayroll() {
  const { data } = await workforceRequest<{ data: ApiPayroll }>("/payroll");
  useLivePayrollMeta.setState({ loaded: true });
  usePayroll.setState({
    salaryStructures: data.salaryStructures, payslips: data.payslips.map((p) => noNull(p)), contracts: data.contracts.map((c) => noNull(c)), loans: data.loans.map((l) => noNull(l)),
    loanPayments: data.loanPayments, escalationLetters: data.escalationLetters.map((x) => noNull(x)), loanEligibilityTiers: data.loanEligibilityTiers, reimbursements: data.reimbursements,
  });
}

const reload = () => loadPayroll();
const post = (path: string, body: unknown = {}) => workforceRequest(path, { method: "POST", body });

export function goLivePayroll() {
  usePayroll.setState({
    setStructure: (employeeId, basicSalary, allowances, deductions) => {
      void liveChange(() => workforceRequest(`/payroll/structures/${employeeId}`, { method: "PUT", body: { basicSalary, allowances, deductions } }), reload);
    },
    runBatch: (batch, startDate, endDate, employeeIds) => { void liveChange(() => post("/payroll/batches", { batch, startDate: isoDay(startDate), endDate: isoDay(endDate), employeeIds }), reload); },
    advancePayslip: (id) => { void liveChange(() => post(`/payroll/payslips/${id}/advance`), reload); },
    confirmBatch: (batch) => { void liveChange(() => post("/payroll/batches/confirm", { batch }), reload); },
    addContract: (c) => {
      void liveChange(() => post("/payroll/contracts", { id: uuid(), employeeId: c.employeeId, title: c.title, startDate: isoDay(c.startDate), ...(c.endDate ? { endDate: isoDay(c.endDate) } : {}), basicSalary: c.basicSalary }), reload);
    },
    requestLoan: (employeeId, type, amount, installments, reason, repaymentMethod) => {
      void liveChange(() => post("/payroll/loans", { id: uuid(), employeeId, type, amount, installments, reason, repaymentMethod }), reload);
    },
    decideLoan: (id, status) => { void liveChange(() => post(`/payroll/loans/${id}/decide`, { status }), reload); },
    recordPayment: (loanId, amount, date) => { void liveChange(() => post(`/payroll/loans/${loanId}/payments`, { amount, date: isoDay(date) }), reload); },
    checkOverdue: (loanId) => { void liveChange(() => post(`/payroll/loans/${loanId}/check-overdue`), reload); },
    // Records that HR sent the printed letter; no mail is sent from here.
    sendEscalationLetter: (id) => { void liveChange(() => post(`/payroll/letters/${id}/sent`), reload); },
    addEligibilityTier: (t) => { void liveChange(() => post("/payroll/loan-tiers", { id: uuid(), minMonthlySalary: t.minMonthlySalary, maxMonthlySalary: t.maxMonthlySalary, maxLoanAmount: t.maxLoanAmount }), reload); },
    requestReimbursement: (employeeId, type, title, amount) => { void liveChange(() => post("/payroll/reimbursements", { id: uuid(), employeeId, type, title, amount }), reload); },
    decideReimbursement: (id, status) => { void liveChange(() => post(`/payroll/reimbursements/${id}/decide`, { status }), reload); },
  });
}

export function clearPayroll() {
  useLivePayrollMeta.setState({ loaded: false });
  usePayroll.setState({ salaryStructures: [], payslips: [], contracts: [], loans: [], loanPayments: [], escalationLetters: [], loanEligibilityTiers: [], reimbursements: [] });
}
