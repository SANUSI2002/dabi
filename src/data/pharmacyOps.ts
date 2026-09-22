// Pharmacy operations — the clinical/operational layer on top of useCatalog's
// simple formulary list: what a drug clinically IS (DrugMaster), the physical
// batches it exists in (DrugBatch, expiry/FEFO), and the append-only running
// balance a controlled substance needs (ControlledMedicineEntry). Kept separate
// from types.ts (matching how clinical.ts / wardRound.ts are already split out).
//
// Financial valuation/GL posting is deliberately NOT reimplemented here — that
// already exists in useInventoryAccounting (FIFO/weighted-average cost layers,
// COGS posting) and is reused via its linkedDrugId bridge.

export type DrugMasterStatus = "Draft" | "Active" | "Inactive" | "Discontinued";

export const DRUG_CATEGORIES = [
  "Analgesics & Antipyretics",
  "Antibiotics",
  "Antimalarials",
  "Antiprotozoals",
  "IV Fluids & Electrolytes",
  "Vitamins & Supplements",
  "Opioid Analgesics",
  "Other",
];

export type DrugMaster = {
  id: string; // same id as useCatalog.drugs[].id
  genericName: string;
  brandName?: string;
  activeIngredient?: string;
  strength: string;
  dosageForm: string;
  route: string;
  manufacturer?: string;
  countryOfManufacture?: string;
  category: string;
  therapeuticClass?: string;
  prescriptionRequired: boolean;
  controlledSubstance: boolean;
  storageRequirement?: string;
  minStock: number;
  reorderLevel: number;
  maxStock: number;
  unitOfMeasure: string;
  packSize?: number;
  patientDescription?: string;
  pharmacistNotes?: string;
  contraindications?: string;
  interactionInfo?: string;
  status: DrugMasterStatus;
  createdBy: string;
  createdAt: string;
};

export const PHARMACY_LOCATIONS = ["Main Pharmacy", "Emergency Pharmacy", "Inpatient Pharmacy", "Outpatient Pharmacy"] as const;
export type PharmacyLocation = (typeof PHARMACY_LOCATIONS)[number];
export const DEFAULT_PHARMACY_LOCATION: PharmacyLocation = "Main Pharmacy";

export type DrugBatchStatus = "Active" | "Quarantined" | "Expired" | "Depleted" | "Written Off";

export type DrugBatch = {
  id: string;
  drugId: string;
  batchNumber: string;
  quantity: number;
  manufactureDate?: string;
  expiryDate: string;
  costPerUnit: number;
  supplierId?: string; // useAP vendor id
  location: PharmacyLocation;
  receivedAt: string;
  receivedBy: string;
  status: DrugBatchStatus;
  quarantineReason?: string;
  quarantinedBy?: string;
  quarantinedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
};

export type ExpiryBucket = "expired" | "30" | "60" | "90" | "180" | "later";

export type ControlledMedicineEntryType = "Received" | "Dispensed";

export type ControlledMedicineEntry = {
  id: string;
  drugId: string;
  type: ControlledMedicineEntryType;
  quantity: number;
  patientId?: string;
  encounterId?: string;
  prescriptionId?: string;
  batchId?: string;
  prescriberName?: string;
  pharmacistName: string;
  witnessBy?: string;
  adjustment?: boolean;
  reason?: string;
  at: string;
  balanceAfter: number;
};

// A prescription in any of these statuses has not yet been dispensed — used
// wherever the app needs a "still needs pharmacy action" count (dashboards,
// billing-readiness messages), now that a prescription passes through several
// pharmacist-verification steps before it's ever actually dispensed.
export const PRESCRIPTION_PENDING_STATUSES = ["Pending", "Under Review", "Approved", "Partially Approved", "Preparing", "Ready"] as const;

export const ORDER_SOURCES = ["Online", "Walk-in", "Doctor Prescription", "Inpatient/Ward", "Emergency", "Internal"] as const;

export const REJECTION_REASONS = [
  "Invalid prescription",
  "Expired prescription",
  "Drug unavailable",
  "Quantity unavailable",
  "Prescription unclear",
  "Incorrect patient",
  "Duplicate prescription",
  "Clinical concern",
  "Prescription does not meet hospital policy",
  "Other",
];
