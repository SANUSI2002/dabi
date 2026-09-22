// Ward Round + structured Physical Examination — frontend clinical data model.
// Kept separate from types.ts (matching how clinical.ts / nursing.ts are already split
// out), since these are their own bounded clinical concern with their own lifecycle.
//
// Interoperability intent (not implemented, just modelled cleanly for it):
//   WardRound            → FHIR Encounter + ClinicalImpression
//   MedicationChange     → FHIR MedicationRequest (status transition trail)
//   PhysicalExamination  → FHIR Observation (exam findings), Condition (problem list)

export type ClinicalProgress = "Improving" | "Stable" | "No significant change" | "Deteriorating" | "Critical";
export const CLINICAL_PROGRESS_OPTIONS: ClinicalProgress[] = ["Improving", "Stable", "No significant change", "Deteriorating", "Critical"];

export type ParticipantRole = "Consultant" | "Resident/Medical Officer" | "Nurse" | "Pharmacist" | "Physiotherapist" | "Dietician" | "Other";
export const PARTICIPANT_ROLES: ParticipantRole[] = ["Consultant", "Resident/Medical Officer", "Nurse", "Pharmacist", "Physiotherapist", "Dietician", "Other"];

export type WardRoundParticipant = {
  id: string;
  role: ParticipantRole;
  name: string;
};

export type WardRoundProblem = {
  id: string;
  /** links to a useClinical Condition when the problem is already on the coded problem list */
  conditionId?: string;
  problem: string;
  status: string; // free text status label chosen by the clinician, e.g. "Improving", "Uncontrolled"
  update: string;
  plan: string;
};

export type ClinicalDevice = {
  id: string;
  kind: "IV cannula" | "Central line" | "Urinary catheter" | "NG tube" | "Drain" | "Chest tube" | "Oxygen device" | "Other";
  label?: string;
  insertedAt?: string;
  removedAt?: string;
};

export type WardRoundPlanTaskType =
  | "Medication order/change" | "Laboratory order" | "Imaging order" | "Procedure" | "Referral"
  | "Specialist consultation" | "Nursing instruction" | "Diet order" | "Physiotherapy" | "Fluid order"
  | "Monitoring instruction" | "Repeat vitals" | "Blood glucose monitoring" | "Discharge planning" | "Other";
export const PLAN_TASK_TYPES: WardRoundPlanTaskType[] = [
  "Medication order/change", "Laboratory order", "Imaging order", "Procedure", "Referral",
  "Specialist consultation", "Nursing instruction", "Diet order", "Physiotherapy", "Fluid order",
  "Monitoring instruction", "Repeat vitals", "Blood glucose monitoring", "Discharge planning", "Other",
];
export type ClinicalTaskStatus = "Pending" | "In Progress" | "Completed" | "Cancelled";
export type ClinicalTaskPriority = "Routine" | "Urgent" | "STAT";

export type ClinicalTask = {
  id: string;
  type: WardRoundPlanTaskType;
  description: string;
  assignedTo?: string;
  priority: ClinicalTaskPriority;
  dueAt?: string;
  status: ClinicalTaskStatus;
};

/** Discrete, auditable medication-order lifecycle actions — never applied automatically. */
export type MedicationChangeAction =
  | "STARTED" | "DOSE_INCREASED" | "DOSE_DECREASED" | "FREQUENCY_CHANGED" | "ROUTE_CHANGED"
  | "HELD" | "STOPPED" | "RESTARTED" | "REPLACED";

export type MedicationChange = {
  id: string;
  patientId: string;
  encounterId: string;
  wardRoundId?: string;
  /** the Prescription.id that now represents the current order (new row when dose/frequency/route changed) */
  medicationOrderId: string;
  /** the Prescription.id this change superseded, if any */
  previousPrescriptionId?: string;
  drug: string;
  action: MedicationChangeAction;
  previousDose?: string;
  previousFrequency?: string;
  previousRoute?: string;
  newDose?: string;
  newFrequency?: string;
  newRoute?: string;
  reason: string;
  clinicalNote?: string;
  monitoringRequired?: string;
  effectiveAt: string;
  clinicianId: string;
  clinicianName: string;
  createdAt: string;
};

export type ExaminationSystemKey =
  | "general" | "cardiovascular" | "respiratory" | "abdominal" | "neurological"
  | "musculoskeletal" | "headAndNeck" | "skin" | "peripheralVascular" | "genitourinary" | "other";

export const EXAMINATION_SYSTEMS: { key: ExaminationSystemKey; label: string }[] = [
  { key: "general", label: "General Examination" },
  { key: "cardiovascular", label: "Cardiovascular" },
  { key: "respiratory", label: "Respiratory / Chest" },
  { key: "abdominal", label: "Abdominal" },
  { key: "neurological", label: "Neurological" },
  { key: "musculoskeletal", label: "Musculoskeletal" },
  { key: "headAndNeck", label: "Head & Neck / ENT" },
  { key: "skin", label: "Skin" },
  { key: "peripheralVascular", label: "Peripheral Vascular" },
  { key: "genitourinary", label: "Genitourinary" },
  { key: "other", label: "Other / Specialty" },
];

export type ExaminationSystemStatus = "Not Examined" | "Normal" | "Abnormal";
export type Laterality = "Left" | "Right" | "Bilateral" | "N/A";

export type PhysicalExaminationSystem = {
  system: ExaminationSystemKey;
  status: ExaminationSystemStatus;
  /** structured field:value findings the clinician actually entered — never inferred */
  findings?: Record<string, string>;
  laterality?: Laterality;
  notes?: string;
  /** sensitive-exam documentation (abdominal/genitourinary) */
  consentDocumented?: boolean;
  chaperoneDocumented?: boolean;
};

export type PhysicalExamination = {
  id: string;
  patientId: string;
  encounterId: string;
  wardRoundId?: string;
  recordedBy: string;
  recordedAt: string;
  systems: PhysicalExaminationSystem[];
};

export type WardRoundSafetyChecklist = {
  medicationReconciliationReviewed: boolean;
  drugAllergiesReviewed: boolean;
  antibioticsReviewed: boolean;
  anticoagulationReviewed: boolean;
  highRiskMedicinesReviewed: boolean;
  prnMedicinesReviewed: boolean;
  ivMedicationReviewed: boolean;
  monitoringRequired: boolean;
  changesCommunicated: boolean;
};

export const EMPTY_SAFETY_CHECKLIST: WardRoundSafetyChecklist = {
  medicationReconciliationReviewed: false,
  drugAllergiesReviewed: false,
  antibioticsReviewed: false,
  anticoagulationReviewed: false,
  highRiskMedicinesReviewed: false,
  prnMedicinesReviewed: false,
  ivMedicationReviewed: false,
  monitoringRequired: false,
  changesCommunicated: false,
};

export type DischargeReadiness = {
  fit: boolean | null;
  expectedDate?: string;
  barriers: string[];
  criteria?: string;
  followUp?: string;
};

export const DISCHARGE_BARRIER_OPTIONS = [
  "Awaiting laboratory result", "Awaiting imaging", "Awaiting physiotherapy", "Medication stabilisation",
  "Social care", "Home oxygen", "Caregiver arrangements", "Other",
];

export type PatientCommunication = {
  patientUpdated: boolean | null;
  medicationChangesExplained: boolean | null;
  planDiscussed: boolean | null;
  caregiverUpdated: "Yes" | "No" | "Not applicable" | null;
  interpreterRequired: boolean | null;
  questions?: string;
  notes?: string;
};

export type WardRoundStatus = "draft" | "signed" | "amended";

export type WardRoundAmendment = {
  id: string;
  note: string;
  by: string;
  at: string;
};

export type WardRound = {
  id: string;
  patientId: string;
  admissionId: string;
  /** the lightweight signed Encounter this round's medication orders/exam are filed against */
  encounterId: string;

  roundDate: string;
  roundTime: string;
  clinicianId: string;
  clinicianName: string;
  clinicianRole: string;
  department?: string;
  participants: WardRoundParticipant[];

  clinicalProgress: ClinicalProgress | "";
  progressNote: string;

  devices: ClinicalDevice[];

  problems: WardRoundProblem[];
  medicationChangeIds: string[];
  examinationId?: string;

  safetyChecklist: WardRoundSafetyChecklist;
  escalationPlan?: string;
  dischargeReadiness: DischargeReadiness;
  communication: PatientCommunication;
  tasks: ClinicalTask[];

  summary: string;
  status: WardRoundStatus;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
  signedBy?: string;
  signedAt?: string;
  amendments: WardRoundAmendment[];
};
