// Expense claims — staff or petty-cash spending that isn't a vendor bill.
// Reference: Expense { amount, description, date, approval_status, project_id,
// is_indirect, allocation_percentage }. Sabi models a multi-line claim with an
// approval routed by amount, then paid (direct or reimbursed to the claimant).

import type { DocApproval } from "@/data/accounting/control";

export type ExpenseLine = {
  id: string;
  accountNumber: number; // expense account
  description: string;
  amount: number;
  taxRateId?: string;
};

export type ExpenseStatus = "Draft" | "Pending Approval" | "Approved" | "Rejected" | "Paid";
export type ExpensePayMode = "Petty Cash" | "Bank — direct" | "Reimburse to staff";

export type ExpenseClaim = {
  id: string;
  number: string;
  claimantId: string; // staff id
  date: string;
  title: string;
  costCenter?: string;
  payMode: ExpensePayMode;
  lines: ExpenseLine[];
  status: ExpenseStatus;
  approval: DocApproval;
  receiptRef?: string;
  journalEntryId?: string; // accrual entry (Dr expense / Cr payable or cash)
  paymentJournalEntryId?: string; // settlement entry when reimbursed
  paidFromAccount?: number;
  createdAt: string;
  paidAt?: string;
};

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
const noAppr: DocApproval = { status: "Not Required", currentLevel: 0, steps: [] };

const el = (accountNumber: number, description: string, amount: number): ExpenseLine => ({
  id: `el-${Math.random().toString(36).slice(2, 7)}`,
  accountNumber,
  description,
  amount,
});

export const seedExpenseClaims: ExpenseClaim[] = [
  {
    id: "exp-1",
    number: "EXP-2026-000001",
    claimantId: "s3",
    date: daysAgo(12),
    title: "Fuel & dispatch — sample runs to reference lab",
    costCenter: "Laboratory",
    payMode: "Reimburse to staff",
    lines: [el(5220, "PMS for dispatch bike x3 trips", 18_000), el(5900, "Toll & parking", 3_500)],
    status: "Paid",
    approval: {
      status: "Approved",
      currentLevel: 1,
      submittedBy: "s3",
      submittedAt: daysAgo(12),
      steps: [{ level: 1, approverRole: "Approver", decision: "Approved", decidedBy: "s2", decidedAt: daysAgo(11) }],
    },
    receiptRef: "RCPT-bundle-Aug",
    createdAt: daysAgo(12),
    paidAt: daysAgo(9),
  },
  {
    id: "exp-2",
    number: "EXP-2026-000002",
    claimantId: "s6",
    date: daysAgo(2),
    title: "Office refreshments & cleaning consumables",
    payMode: "Petty Cash",
    lines: [el(5300, "Tea, coffee, sugar", 9_500), el(5240, "Disinfectant, mop heads", 14_000)],
    status: "Draft",
    approval: noAppr,
    createdAt: daysAgo(2),
  },
];
