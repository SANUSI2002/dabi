// Accounting RBAC + approval controls.
//
// Reference: spatie/laravel-permission with per-verb permissions (view/create/
// edit/submit/approve/reject/post/reverse/export/configure) + an ApprovalRule
// (threshold by amount) driving a multi-step ApprovalRequest via the Approvable
// concern. Sabi keeps this self-contained in the Accounting module, keyed off
// the signed-in account's financeRole (on the shared Account — no HR import).

import type { FinanceRole } from "@/data/accounts";

export type FinancePermission =
  | "view"
  | "create"
  | "edit"
  | "submit"
  | "approve"
  | "reject"
  | "post"
  | "reverse"
  | "export"
  | "configure";

export const ROLE_PERMISSIONS: Record<FinanceRole, FinancePermission[]> = {
  "Finance Controller": ["view", "create", "edit", "submit", "approve", "reject", "post", "reverse", "export", "configure"],
  Accountant: ["view", "create", "edit", "submit", "post", "export"],
  Approver: ["view", "approve", "reject", "export"],
  Auditor: ["view", "export"],
  None: [],
};

export type ApprovableDoc = "Purchase Requisition" | "Purchase Order" | "Bill" | "Vendor Payment" | "Expense Claim" | "Journal Entry";

// A rule fires when a document of `docType` has an amount within [minAmount, maxAmount).
// Each matching rule contributes one approval step, ordered by `level`.
export type ApprovalRule = {
  id: string;
  docType: ApprovableDoc;
  minAmount: number;
  maxAmount: number | null; // null = no upper bound
  approverRole: Exclude<FinanceRole, "None" | "Auditor">;
  level: number;
  active: boolean;
};

export type ApprovalDecisionKind = "Approved" | "Rejected";

export type DocApprovalStep = {
  level: number;
  approverRole: ApprovalRule["approverRole"];
  decision: "Pending" | ApprovalDecisionKind;
  decidedBy?: string; // staff id
  decidedAt?: string;
  comment?: string;
};

export type DocApprovalStatus = "Not Required" | "Pending" | "Approved" | "Rejected";

export type DocApproval = {
  status: DocApprovalStatus;
  currentLevel: number;
  steps: DocApprovalStep[];
  submittedBy?: string;
  submittedAt?: string;
};

export const seedApprovalRules: ApprovalRule[] = [
  // Purchase requisitions
  { id: "ar-pr-1", docType: "Purchase Requisition", minAmount: 250_000, maxAmount: 2_000_000, approverRole: "Approver", level: 1, active: true },
  { id: "ar-pr-2", docType: "Purchase Requisition", minAmount: 2_000_000, maxAmount: null, approverRole: "Finance Controller", level: 2, active: true },
  // Bills
  { id: "ar-bill-1", docType: "Bill", minAmount: 500_000, maxAmount: 3_000_000, approverRole: "Accountant", level: 1, active: true },
  { id: "ar-bill-2", docType: "Bill", minAmount: 3_000_000, maxAmount: null, approverRole: "Finance Controller", level: 2, active: true },
  // Vendor payments
  { id: "ar-vp-1", docType: "Vendor Payment", minAmount: 1_000_000, maxAmount: null, approverRole: "Finance Controller", level: 1, active: true },
  // Expense claims
  { id: "ar-exp-1", docType: "Expense Claim", minAmount: 50_000, maxAmount: 250_000, approverRole: "Approver", level: 1, active: true },
  { id: "ar-exp-2", docType: "Expense Claim", minAmount: 250_000, maxAmount: null, approverRole: "Finance Controller", level: 2, active: true },
  // Manual journal entries
  { id: "ar-je-1", docType: "Journal Entry", minAmount: 1_000_000, maxAmount: null, approverRole: "Finance Controller", level: 1, active: true },
];
