export type CalibrationResult = "Pass" | "Fail";
export type CalibrationRecordStatus = "Scheduled" | "In Progress" | "Completed" | "Cancelled";

export type CalibrationRecord = {
  id: string;
  equipmentId: string;
  status: CalibrationRecordStatus;
  scheduledFor: string;
  requestedAt: string;
  requestedBy: string;
  technician?: string;
  vendor?: string;
  standardsUsed?: string;
  performedAt?: string;
  result?: CalibrationResult;
  certificateNumber?: string;
  certificateExpiry?: string;
  notes?: string;
  cancelReason?: string;
};
