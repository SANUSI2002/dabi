import type { CodeableConcept } from "./clinicalCoding";

// FHIR-aligned frontend representations of the longitudinal clinical record.
// These are in-memory demo structures, not a conformant FHIR store.

// ---------------------------------------------------------------------------
// Condition (problem list + encounter diagnoses)
// ---------------------------------------------------------------------------

export type ConditionClinicalStatus = "active" | "recurrence" | "relapse" | "inactive" | "remission" | "resolved";
export type ConditionVerificationStatus = "unconfirmed" | "provisional" | "differential" | "confirmed" | "refuted";
export type ConditionCategory = "problem-list-item" | "encounter-diagnosis";

export type Condition = {
  id: string;
  patientId: string;
  code: CodeableConcept;
  clinicalStatus: ConditionClinicalStatus;
  verificationStatus: ConditionVerificationStatus;
  category: ConditionCategory;
  onsetDate?: string;
  abatementDate?: string;
  recordedDate: string;
  recordedBy: string;
  encounterId?: string;
  note?: string;
};

export const CONDITION_CLINICAL_STATUS: ConditionClinicalStatus[] = [
  "active", "recurrence", "relapse", "inactive", "remission", "resolved",
];
export const CONDITION_VERIFICATION_STATUS: ConditionVerificationStatus[] = [
  "unconfirmed", "provisional", "differential", "confirmed", "refuted",
];

// ---------------------------------------------------------------------------
// AllergyIntolerance
// ---------------------------------------------------------------------------

export type AllergyType = "allergy" | "intolerance";
export type AllergyCategory = "medication" | "food" | "environment" | "biologic";
export type AllergyCriticality = "low" | "high" | "unable-to-assess";
export type AllergyClinicalStatus = "active" | "inactive" | "resolved";
export type AllergyVerificationStatus = "unconfirmed" | "presumed" | "confirmed" | "refuted";
export type ReactionSeverity = "mild" | "moderate" | "severe";

export type AllergyReaction = {
  manifestation: string[];
  severity: ReactionSeverity;
  description?: string;
  onset?: string;
};

export type AllergyIntolerance = {
  id: string;
  patientId: string;
  substance: CodeableConcept;
  type: AllergyType;
  category: AllergyCategory;
  criticality: AllergyCriticality;
  clinicalStatus: AllergyClinicalStatus;
  verificationStatus: AllergyVerificationStatus;
  reactions: AllergyReaction[];
  recordedDate: string;
  recordedBy: string;
  lastOccurrence?: string;
  note?: string;
  /** where this record came from — e.g. "Imported from registration free text" */
  source?: string;
};

export const ALLERGY_CATEGORIES: AllergyCategory[] = ["medication", "food", "environment", "biologic"];
export const ALLERGY_CRITICALITY: AllergyCriticality[] = ["low", "high", "unable-to-assess"];
export const REACTION_SEVERITIES: ReactionSeverity[] = ["mild", "moderate", "severe"];
export const COMMON_MANIFESTATIONS = [
  "Rash", "Urticaria (hives)", "Angioedema", "Pruritus (itching)", "Nausea", "Vomiting",
  "Diarrhoea", "Bronchospasm", "Dyspnoea", "Anaphylaxis", "Hypotension", "Stevens-Johnson syndrome",
];

// ---------------------------------------------------------------------------
// CarePlan
// ---------------------------------------------------------------------------

export type CarePlanStatus = "draft" | "active" | "on-hold" | "completed" | "revoked";
export type CarePlanActivityStatus = "not-started" | "scheduled" | "in-progress" | "on-hold" | "completed" | "cancelled";
export type CareGoalStatus = "proposed" | "active" | "on-hold" | "achieved" | "not-achieved" | "cancelled";

export type CareGoal = {
  id: string;
  description: string;
  target?: string;
  status: CareGoalStatus;
  dueDate?: string;
};

export type CareActivity = {
  id: string;
  description: string;
  owner?: string;
  status: CarePlanActivityStatus;
  dueDate?: string;
  scheduledDetail?: string;
};

export type CarePlan = {
  id: string;
  patientId: string;
  title: string;
  status: CarePlanStatus;
  category: string;
  description?: string;
  period: { start: string; end?: string };
  goals: CareGoal[];
  activities: CareActivity[];
  /** condition ids this plan addresses */
  addresses: string[];
  createdBy: string;
  createdDate: string;
  reviewDate?: string;
};

export const CARE_PLAN_STATUS: CarePlanStatus[] = ["draft", "active", "on-hold", "completed", "revoked"];
export const CARE_ACTIVITY_STATUS: CarePlanActivityStatus[] = [
  "not-started", "scheduled", "in-progress", "on-hold", "completed", "cancelled",
];
export const CARE_GOAL_STATUS: CareGoalStatus[] = [
  "proposed", "active", "on-hold", "achieved", "not-achieved", "cancelled",
];

// ---------------------------------------------------------------------------
// Deterministic seed data (references the useEmr mock patients p3 / p13)
// ---------------------------------------------------------------------------

const daysAgo = (n: number) => {
  const date = new Date();
  date.setDate(date.getDate() - n);
  date.setHours(10, 0, 0, 0);
  return date.toISOString();
};

export const seedConditions: Condition[] = [
  {
    id: "cond-1", patientId: "p3",
    code: { system: "icd11", code: "5A11", display: "Type 2 diabetes mellitus", version: "2024-01" },
    clinicalStatus: "active", verificationStatus: "confirmed", category: "problem-list-item",
    onsetDate: daysAgo(420), recordedDate: daysAgo(400), recordedBy: "Dr. Adaeze Okonjo",
    note: "Diet + metformin. Last HbA1c 7.8%.",
  },
  {
    id: "cond-2", patientId: "p3",
    code: { system: "icd11", code: "BA00", display: "Essential hypertension", version: "2024-01" },
    clinicalStatus: "active", verificationStatus: "confirmed", category: "problem-list-item",
    onsetDate: daysAgo(300), recordedDate: daysAgo(300), recordedBy: "Dr. Adaeze Okonjo",
  },
  {
    id: "cond-3", patientId: "p13",
    code: { system: "snomed", code: "77386006", display: "Pregnant (finding)" },
    clinicalStatus: "active", verificationStatus: "confirmed", category: "problem-list-item",
    onsetDate: daysAgo(160), recordedDate: daysAgo(120), recordedBy: "Nurse Grace Nwangbo",
    note: "G1P0. EDD in ~4 months. Enrolled in ANC.",
  },
  {
    id: "cond-4", patientId: "p13",
    code: { system: "icd11", code: "1F40", display: "Malaria, uncomplicated", version: "2024-01" },
    clinicalStatus: "resolved", verificationStatus: "confirmed", category: "encounter-diagnosis",
    onsetDate: daysAgo(34), abatementDate: daysAgo(28), recordedDate: daysAgo(33), recordedBy: "Dr. Adaeze Okonjo",
    encounterId: "e1", note: "Completed ACT course. Symptom-free at review.",
  },
];

export const seedAllergies: AllergyIntolerance[] = [
  {
    id: "alg-1", patientId: "p3",
    substance: { system: "snomed", code: "373270004", display: "Penicillin" },
    type: "allergy", category: "medication", criticality: "high",
    clinicalStatus: "active", verificationStatus: "confirmed",
    reactions: [{ manifestation: ["Urticaria (hives)", "Angioedema"], severity: "moderate", description: "Facial swelling and widespread hives within 1 hour of amoxicillin." }],
    recordedDate: daysAgo(400), recordedBy: "Dr. Adaeze Okonjo", lastOccurrence: daysAgo(400),
    source: "Confirmed at consultation",
  },
];

export const seedCarePlans: CarePlan[] = [
  {
    id: "plan-1", patientId: "p3",
    title: "Type 2 diabetes — chronic disease management",
    status: "active", category: "Chronic disease",
    description: "Structured follow-up for glycaemic and blood-pressure control.",
    period: { start: daysAgo(400) },
    reviewDate: daysAgo(-30),
    addresses: ["cond-1", "cond-2"],
    createdBy: "Dr. Adaeze Okonjo", createdDate: daysAgo(400),
    goals: [
      { id: "goal-1", description: "HbA1c below 7.0%", target: "< 7.0%", status: "active", dueDate: daysAgo(-60) },
      { id: "goal-2", description: "Blood pressure below 140/90 mmHg", target: "< 140/90", status: "active", dueDate: daysAgo(-60) },
    ],
    activities: [
      { id: "act-1", description: "Quarterly HbA1c", owner: "Laboratory", status: "scheduled", dueDate: daysAgo(-14), scheduledDetail: "Every 3 months" },
      { id: "act-2", description: "Foot examination", owner: "Dr. Adaeze Okonjo", status: "not-started", dueDate: daysAgo(-30) },
      { id: "act-3", description: "Dietitian counselling", owner: "Nutrition", status: "completed", dueDate: daysAgo(120) },
      { id: "act-4", description: "Home BP monitoring diary review", owner: "Nurse Grace Nwangbo", status: "in-progress", dueDate: daysAgo(-7) },
    ],
  },
];
