// Warranty tracking (directive section 26). Separate store from EquipmentRecord.lifecycle's
// simple warrantyStart/warrantyEnd fields (kept for the Overview tab's quick summary) because a
// real warranty needs provider/contact/SLA detail and an independent claims history — the same
// reasoning that split maintenance and calibration out of the equipment record.
export type WarrantyInfo = {
  equipmentId: string;
  provider: string;
  start: string;
  end: string;
  coverage: string;
  contactName?: string;
  contactPhone?: string;
  slaHours?: number;
  updatedAt: string;
  updatedBy: string;
};

export type WarrantyClaimStatus = "Submitted" | "Approved" | "In Repair" | "Rejected" | "Completed";

export type WarrantyClaim = {
  id: string;
  equipmentId: string;
  claimNumber?: string;
  issue: string;
  status: WarrantyClaimStatus;
  raisedAt: string;
  raisedBy: string;
  relatedWorkOrderId?: string;
  repairedUnderWarranty?: boolean;
  costRecovered?: number;
  resolvedAt?: string;
  resolutionNote?: string;
};

export type WarrantyStatus = "Active" | "Expiring Soon" | "Expired" | "Not Tracked";

export function warrantyStatusFor(warranty: WarrantyInfo | undefined): WarrantyStatus {
  if (!warranty) return "Not Tracked";
  const end = new Date(warranty.end).getTime();
  const daysLeft = (end - Date.now()) / 86400000;
  if (daysLeft < 0) return "Expired";
  if (daysLeft <= 30) return "Expiring Soon";
  return "Active";
}
