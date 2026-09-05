// Promotions — role/grade change with an approval gate and a tracked
// handover of the outgoing responsibilities to a successor.

// "Proposed" / rejected state is tracked by the linked approval request
// (see useApprovals) — the Promotion record itself only distinguishes
// not-yet-applied from applied, to avoid two sources of truth.
export type PromotionStatus = "Proposed" | "Effective";
export type HandoverStatus = "Not started" | "In progress" | "Complete";

export type Promotion = {
  id: string;
  employeeId: string;
  fromJobPositionId?: string;
  fromJobRoleId?: string;
  fromCadre?: string;
  toJobPositionId?: string;
  toJobRoleId?: string;
  toCadre?: string;
  effectiveDate: string;
  reason: string;
  status: PromotionStatus;
  createdAt: string;
  appliedAt?: string;
  successorId?: string;
  handoverNotes?: string;
  handoverStatus: HandoverStatus;
  handoverCompletedAt?: string;
};

export const promotions: Promotion[] = [];
