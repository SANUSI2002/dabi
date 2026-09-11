export type AlarmSeverity = "Informational" | "Low" | "Medium" | "High" | "Critical" | "Emergency";
export type AlarmLifecycle = "Raised" | "Acknowledged" | "Investigating" | "Escalated" | "Resolved" | "Closed" | "Suppressed";

export type AlarmCategory =
  | "Threshold Breach" | "Connectivity" | "Calibration" | "Maintenance" | "Safety"
  | "Unauthorized Activity" | "Consumable" | "Power" | "Other";

export type EquipmentAlarm = {
  id: string;
  equipmentId: string; // EquipmentRecord.id
  raisedAt: string;
  source: EventSource;
  severity: AlarmSeverity;
  category: AlarmCategory;
  description: string;
  parameter?: string;
  value?: number;
  threshold?: number;
  status: AlarmLifecycle;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  investigationNote?: string;
  escalatedTo?: string;
  escalatedAt?: string;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  correlationId?: string;
};

// Source attribution is mandatory on every event/alarm — never let simulated activity look like
// a real device connection or an unattributed system action.
export type EventSource = "SIMULATOR" | "DEVICE_GATEWAY" | "USER" | "SYSTEM";

export type TimelineEventType =
  | "REGISTERED" | "POWER_ON" | "POWER_OFF" | "STARTING" | "READY" | "IDLE"
  | "TEST_STARTED" | "TEST_COMPLETED" | "RESULT_GENERATED"
  | "WARNING" | "ERROR" | "MAINTENANCE_STARTED" | "MAINTENANCE_COMPLETED"
  | "CALIBRATION_STARTED" | "CALIBRATION_COMPLETED"
  | "OFFLINE" | "CONNECTION_LOST" | "CONNECTION_RESTORED"
  | "ALARM_RAISED" | "ALARM_ACKNOWLEDGED" | "ALARM_RESOLVED"
  | "LOCATION_CHANGED" | "TRANSFERRED" | "REPAIRED" | "DECOMMISSIONED";

export type TimelineEvent = {
  id: string;
  equipmentId: string;
  type: TimelineEventType;
  at: string;
  source: EventSource;
  actor?: string; // user name, or the adapter/simulator identifier
  detail?: string;
  patientId?: string;
  relatedOrderId?: string;
  correlationId: string;
  idempotencyKey: string;
};
