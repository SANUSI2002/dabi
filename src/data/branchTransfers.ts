// Branch transfers — move an employee from one facility/branch to
// another, gated by approval and closed out with a tracked handover,
// mirroring the Promotions pattern.

export type TransferStatus = "Proposed" | "Effective";
export type HandoverStatus = "Not started" | "In progress" | "Complete";

export type BranchTransfer = {
  id: string;
  employeeId: string;
  fromCompanyId?: string;
  toCompanyId: string;
  effectiveDate: string;
  reason: string;
  status: TransferStatus;
  createdAt: string;
  appliedAt?: string;
  successorId?: string;
  handoverNotes?: string;
  handoverStatus: HandoverStatus;
  handoverCompletedAt?: string;
};

export const branchTransfers: BranchTransfer[] = [];
