import type { EquipmentCategory } from "@/data/equipment";

export type WorkOrderType = "Preventive" | "Corrective" | "Emergency";
export type WorkOrderStatus = "Requested" | "Scheduled" | "In Progress" | "Awaiting Parts" | "Testing" | "Completed" | "Cancelled";
export type WorkOrderSeverity = "Low" | "Medium" | "High" | "Critical";

export type ChecklistItem = { id: string; label: string; done: boolean; note?: string };

export type PartUsed = { name: string; qty: number; cost: number };

export type WorkOrder = {
  id: string;
  equipmentId: string;
  type: WorkOrderType;
  status: WorkOrderStatus;
  severity: WorkOrderSeverity;
  reportedAt: string;
  reportedBy: string;
  failureCategory?: string;
  description: string;
  scheduledFor?: string;
  technician?: string;
  checklist: ChecklistItem[];
  startedAt?: string;
  diagnosis?: string;
  correctiveAction?: string;
  partsUsed: PartUsed[];
  laborCost?: number;
  completedAt?: string;
  downtimeMinutes?: number;
  returnToServiceTested?: boolean;
  returnToServiceNote?: string;
  cancelReason?: string;
};

// Configurable checklist templates per equipment category — directive section 20. Kept as
// editable-in-code defaults rather than a full template-management UI, which is out of scope
// for this phase.
export const CHECKLIST_TEMPLATES: Record<EquipmentCategory, string[]> = {
  "Laboratory Analyzer": ["Reagent system", "Sample probe", "Waste system", "Calibration check", "QC run", "Cleaning"],
  "Radiology Imaging": ["Tube warm-up", "Detector check", "Collimator alignment", "Radiation safety check", "Image quality test"],
  "ICU Device": ["Pressure/leak test", "Oxygen sensor", "Battery", "Alarm test", "Flow sensor", "Filter replacement"],
  "Theatre Equipment": ["Output calibration", "Electrical safety test", "Grounding check", "Alarm test"],
  "Dialysis Equipment": ["Conductivity check", "Pressure test", "Disinfection cycle", "Water quality check", "Alarm test"],
  "Pharmacy Cold Chain": ["Door seal check", "Temperature log review", "Compressor check", "Alarm test", "Backup power check"],
  "Generator": ["Fuel", "Oil", "Battery", "Voltage/frequency", "Cooling system", "Leak check", "Load test"],
  "HVAC": ["Filter replacement", "Refrigerant level", "Compressor check", "Ductwork inspection", "Thermostat calibration"],
  "Medical Gas": ["Pressure test", "Leak check", "Alarm panel test", "Manifold inspection", "Tank level check"],
  "Water Treatment": ["Filter replacement", "Pressure check", "Water quality test", "Pump inspection"],
  "Solar / Inverter": ["Panel cleaning", "Battery check", "Inverter output test", "Wiring inspection"],
  "Elevator": ["Door mechanism", "Cable inspection", "Safety brake test", "Emergency phone test"],
  "Other Infrastructure": ["General inspection", "Safety check"],
};

export function defaultChecklistFor(category: EquipmentCategory): ChecklistItem[] {
  return CHECKLIST_TEMPLATES[category].map((label, i) => ({ id: `${i}`, label, done: false }));
}
