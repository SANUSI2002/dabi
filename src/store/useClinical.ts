import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { localConcept, type CodeableConcept } from "@/data/clinicalCoding";
import {
  seedConditions, seedAllergies, seedCarePlans,
  type Condition, type ConditionClinicalStatus, type ConditionCategory,
  type AllergyIntolerance, type AllergyReaction, type AllergyCategory, type AllergyCriticality,
  type CarePlan, type CareActivity, type CarePlanActivityStatus, type CareGoal, type CareGoalStatus,
} from "@/data/clinical";
import type { Patient } from "@/data/types";
import { persisted } from "@/platform/persist";

const rid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const actor = () => useIdentity.getState().user.name;

type ClinicalState = {
  conditions: Condition[];
  allergies: AllergyIntolerance[];
  carePlans: CarePlan[];

  conditionsFor: (patientId?: string | null) => Condition[];
  /** structured allergies for a patient, synthesising a record from the legacy
   *  free-text `patient.allergies` string when nothing structured exists yet */
  allergiesFor: (patient?: Patient | null) => AllergyIntolerance[];
  carePlansFor: (patientId?: string | null) => CarePlan[];

  addCondition: (input: {
    patientId: string;
    code: CodeableConcept;
    category?: ConditionCategory;
    clinicalStatus?: ConditionClinicalStatus;
    verificationStatus?: Condition["verificationStatus"];
    onsetDate?: string;
    encounterId?: string;
    note?: string;
  }) => string;
  setConditionClinicalStatus: (id: string, status: ConditionClinicalStatus) => void;
  setConditionVerification: (id: string, status: Condition["verificationStatus"]) => void;

  addAllergy: (input: {
    patientId: string;
    substance: CodeableConcept;
    type?: AllergyIntolerance["type"];
    category?: AllergyCategory;
    criticality?: AllergyCriticality;
    verificationStatus?: AllergyIntolerance["verificationStatus"];
    reactions?: AllergyReaction[];
    note?: string;
    source?: string;
  }) => string;
  setAllergyClinicalStatus: (id: string, status: AllergyIntolerance["clinicalStatus"]) => void;
  setAllergyVerification: (id: string, status: AllergyIntolerance["verificationStatus"]) => void;

  addCarePlan: (input: Omit<CarePlan, "id" | "createdBy" | "createdDate">) => string;
  setCarePlanStatus: (id: string, status: CarePlan["status"]) => void;
  setActivityStatus: (planId: string, activityId: string, status: CarePlanActivityStatus) => void;
  setGoalStatus: (planId: string, goalId: string, status: CareGoalStatus) => void;
  addActivity: (planId: string, activity: Omit<CareActivity, "id">) => void;
  addGoal: (planId: string, goal: Omit<CareGoal, "id">) => void;
};

/** parse "Penicillin, sulfa" style free text into individual substances */
function parseAllergyText(text?: string): string[] {
  if (!text) return [];
  const trimmed = text.trim();
  if (!trimmed || /^(nka|nkda|none|nil|no known)/i.test(trimmed)) return [];
  return trimmed.split(/[,;/]|\band\b/i).map((part) => part.trim()).filter(Boolean);
}

/**
 * Pure selector: structured allergies for a patient, or an "unconfirmed / imported
 * from registration free text" synthesised record if nothing structured exists.
 * Safe to call from a component render or a zustand selector.
 */
export function selectAllergiesFor(
  allergyRecords: AllergyIntolerance[],
  patient: Patient | null | undefined,
): AllergyIntolerance[] {
  if (!patient) return [];
  const structured = allergyRecords.filter((allergy) => allergy.patientId === patient.id);
  if (structured.length > 0) return structured;
  return parseAllergyText(patient.allergies).map((substanceText, index) => ({
    id: `alg-legacy-${patient.id}-${index}`,
    patientId: patient.id,
    substance: localConcept(substanceText),
    type: "allergy" as const,
    category: "medication" as const,
    criticality: "unable-to-assess" as const,
    clinicalStatus: "active" as const,
    verificationStatus: "unconfirmed" as const,
    reactions: [],
    recordedDate: patient.registeredAt,
    recordedBy: "Registration",
    source: "Imported from registration free text — not yet reviewed",
  }));
}

export const useClinical = create<ClinicalState>(persisted<ClinicalState>("clinical", (set, get) => ({
  conditions: seedConditions,
  allergies: seedAllergies,
  carePlans: seedCarePlans,

  conditionsFor: (patientId) =>
    !patientId ? [] : get().conditions.filter((condition) => condition.patientId === patientId),

  allergiesFor: (patient) => selectAllergiesFor(get().allergies, patient),

  carePlansFor: (patientId) =>
    !patientId ? [] : get().carePlans.filter((plan) => plan.patientId === patientId),

  addCondition: (input) => {
    const id = `cond-${rid()}`;
    const condition: Condition = {
      id,
      patientId: input.patientId,
      code: input.code,
      clinicalStatus: input.clinicalStatus ?? "active",
      verificationStatus: input.verificationStatus ?? "provisional",
      category: input.category ?? "problem-list-item",
      onsetDate: input.onsetDate,
      recordedDate: now(),
      recordedBy: actor(),
      encounterId: input.encounterId,
      note: input.note,
    };
    set((state) => ({ conditions: [condition, ...state.conditions] }));
    audit(`added ${condition.category === "encounter-diagnosis" ? "encounter diagnosis" : "problem"} — ${input.code.display}`, `clinical/condition/${input.patientId}`);
    return id;
  },

  setConditionClinicalStatus: (id, status) => {
    set((state) => ({
      conditions: state.conditions.map((condition) =>
        condition.id === id
          ? { ...condition, clinicalStatus: status, abatementDate: status === "resolved" ? now() : condition.abatementDate }
          : condition,
      ),
    }));
    audit(`set problem status — ${status}`, `clinical/condition/${id}`);
  },

  setConditionVerification: (id, status) => {
    set((state) => ({
      conditions: state.conditions.map((condition) =>
        condition.id === id ? { ...condition, verificationStatus: status } : condition,
      ),
    }));
    audit(`set problem verification — ${status}`, `clinical/condition/${id}`);
  },

  addAllergy: (input) => {
    const id = `alg-${rid()}`;
    const allergy: AllergyIntolerance = {
      id,
      patientId: input.patientId,
      substance: input.substance,
      type: input.type ?? "allergy",
      category: input.category ?? "medication",
      criticality: input.criticality ?? "unable-to-assess",
      clinicalStatus: "active",
      verificationStatus: input.verificationStatus ?? "unconfirmed",
      reactions: input.reactions ?? [],
      recordedDate: now(),
      recordedBy: actor(),
      note: input.note,
      source: input.source,
    };
    set((state) => ({ allergies: [allergy, ...state.allergies] }));
    audit(`recorded allergy — ${input.substance.display}`, `clinical/allergy/${input.patientId}`);
    return id;
  },

  setAllergyClinicalStatus: (id, status) => {
    set((state) => ({
      allergies: state.allergies.map((allergy) => (allergy.id === id ? { ...allergy, clinicalStatus: status } : allergy)),
    }));
    audit(`set allergy status — ${status}`, `clinical/allergy/${id}`);
  },

  setAllergyVerification: (id, status) => {
    set((state) => ({
      allergies: state.allergies.map((allergy) => (allergy.id === id ? { ...allergy, verificationStatus: status } : allergy)),
    }));
    audit(`set allergy verification — ${status}`, `clinical/allergy/${id}`);
  },

  addCarePlan: (input) => {
    const id = `plan-${rid()}`;
    set((state) => ({
      carePlans: [{ ...input, id, createdBy: actor(), createdDate: now() }, ...state.carePlans],
    }));
    audit(`created care plan — ${input.title}`, `clinical/care-plan/${input.patientId}`);
    return id;
  },

  setCarePlanStatus: (id, status) => {
    set((state) => ({ carePlans: state.carePlans.map((plan) => (plan.id === id ? { ...plan, status } : plan)) }));
    audit(`set care plan status — ${status}`, `clinical/care-plan/${id}`);
  },

  setActivityStatus: (planId, activityId, status) => {
    set((state) => ({
      carePlans: state.carePlans.map((plan) =>
        plan.id === planId
          ? { ...plan, activities: plan.activities.map((activity) => (activity.id === activityId ? { ...activity, status } : activity)) }
          : plan,
      ),
    }));
    audit(`care plan activity — ${status}`, `clinical/care-plan/${planId}/activity/${activityId}`);
  },

  setGoalStatus: (planId, goalId, status) => {
    set((state) => ({
      carePlans: state.carePlans.map((plan) =>
        plan.id === planId
          ? { ...plan, goals: plan.goals.map((goal) => (goal.id === goalId ? { ...goal, status } : goal)) }
          : plan,
      ),
    }));
    audit(`care plan goal — ${status}`, `clinical/care-plan/${planId}/goal/${goalId}`);
  },

  addActivity: (planId, activity) => {
    set((state) => ({
      carePlans: state.carePlans.map((plan) =>
        plan.id === planId ? { ...plan, activities: [...plan.activities, { ...activity, id: `act-${rid()}` }] } : plan,
      ),
    }));
    audit("added care plan activity", `clinical/care-plan/${planId}`);
  },

  addGoal: (planId, goal) => {
    set((state) => ({
      carePlans: state.carePlans.map((plan) =>
        plan.id === planId ? { ...plan, goals: [...plan.goals, { ...goal, id: `goal-${rid()}` }] } : plan,
      ),
    }));
    audit("added care plan goal", `clinical/care-plan/${planId}`);
  },
})));

/** true when a care activity is past its due date and not yet done/cancelled */
export function isActivityOverdue(activity: CareActivity): boolean {
  if (!activity.dueDate) return false;
  if (activity.status === "completed" || activity.status === "cancelled") return false;
  return new Date(activity.dueDate).getTime() < Date.now();
}
