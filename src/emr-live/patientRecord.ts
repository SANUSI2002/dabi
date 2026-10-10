import { useEffect } from "react";
import { create } from "zustand";
import type { Admission, Encounter, EncounterStatus, Invoice, LabOrder, Patient, QueueEntry, Station, Vitals } from "@/data/types";
import type { AllergyIntolerance, Condition, ConditionClinicalStatus, ConditionVerificationStatus } from "@/data/clinical";
import { ALLERGEN_SNOMED, icd11Concept, localConcept, type CodeableConcept } from "@/data/clinicalCoding";
import { emrRequest } from "./client";
import { STATUS_FROM_API, patientFromApi, type ApiPatient, type ApiQueueStatus } from "./mappers";
import { liveLabTest } from "./lab";
import { vitalsSets } from "./consultation";
import { liveRxLine, type LiveRxLine } from "./pharmacy";
import { liveAdmission } from "./inpatient";

// The patient chart and Medical History in live mode: one read of the patient's record from the
// hospital's EMR (GET /patients/:id/record), mapped onto the shapes those screens already render,
// plus the chart's own changes (problem list, allergies, note amendments).

type ApiLabOrder = Parameters<typeof liveLabTest>[0];
type ApiRx = Parameters<typeof liveRxLine>[0];
type ApiAdmission = Parameters<typeof liveAdmission>[0];
type ApiObservation = Parameters<typeof vitalsSets>[0][number];

type ApiAmendment = { id: string; reason: string; body: string; authorName: string | null; createdAt: string };
type ApiNote = {
  id: string; kind: "CONSULTATION" | "PROGRESS" | "NURSING" | "PROCEDURE" | "DISCHARGE"; status: "DRAFT" | "SIGNED"; version: number;
  subjective: string | null; objective: string | null; assessment: string | null; plan: string | null; body: string | null;
  followUp: string | null; patientInstructions: string | null;
  authorName: string | null; signedByName: string | null; signedAt: string | null; createdAt: string; amendments: ApiAmendment[];
};
type ApiDiagnosis = { id: string; code: string; codeSystem: "ICD10" | "ICD11"; description: string; rank: "PRIMARY" | "SECONDARY"; onProblemList: boolean; createdAt: string; recordedByName: string | null };
type ApiRecordEncounter = {
  id: string; class: "OUTPATIENT" | "INPATIENT" | "EMERGENCY" | "TELEHEALTH"; status: "ARRIVED" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";
  reason: string | null; visitType: string | null; arrivedAt: string; nhmisIndicators: string[]; attendingName: string | null;
  notes: ApiNote[]; diagnoses: ApiDiagnosis[]; queueEntry: { station: string; status: ApiQueueStatus } | null;
};
type ApiProblem = {
  id: string; problemId: string | null; fromDiagnosisId?: string; encounterId: string | null; code: string; codeSystem: "ICD10" | "ICD11"; description: string;
  clinicalStatus: string; verificationStatus: string | null; onsetDate: string | null; abatementDate: string | null; note: string | null;
  recordedByName: string | null; createdAt: string; version: number | null;
};
type ApiRecordAllergy = {
  id: string; substance: string; substanceCode: string; reaction: string | null; severity: "MILD" | "MODERATE" | "SEVERE";
  category: string | null; criticality: string | null; verificationStatus: "UNCONFIRMED" | "PRESUMED" | "CONFIRMED"; manifestations: string[];
  note: string | null; source: string | null; recordedByName: string | null; createdAt: string;
};
type ApiRecordInvoice = {
  id: string; number: string; status: "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID"; issuedAt: string;
  taxMinor: number; discountMinor: number; totalMinor: number; balanceMinor: number;
  lines: { description: string; quantity: number; unitPriceMinor: number; category: string; sourceKey: string | null }[];
};
export type ApiPatientRecord = {
  patient: ApiPatient;
  encounters: ApiRecordEncounter[];
  vitals: ApiObservation[];
  problems: ApiProblem[];
  allergies: ApiRecordAllergy[];
  labs: ApiLabOrder[] | null;
  prescriptions: ApiRx[] | null;
  admissions: ApiAdmission[] | null;
  invoices: ApiRecordInvoice[] | null;
  sections: { labs: boolean; prescriptions: boolean; admissions: boolean; invoices: boolean };
};

/** A problem-list row plus what a change needs: stored entries have an id and version; a flagged diagnosis not yet stored has neither. */
export type LiveCondition = Condition & { problemId: string | null; fromDiagnosisId?: string; version: number | null };

export type LivePatientRecord = {
  patient: Patient;
  encounters: Encounter[];
  labs: LabOrder[];
  medications: LiveRxLine[];
  vitals: Vitals[];
  conditions: LiveCondition[];
  allergies: AllergyIntolerance[];
  admissions: Admission[];
  invoices: Invoice[];
  /** What the patient still owes on issued invoices, in naira. */
  outstanding: number;
  /** Where the patient is in clinic right now (an open visit's queue place), if anywhere. */
  inClinic: { station: Station; status: QueueEntry["status"] } | null;
  /** The latest time anything on the record was written. */
  lastUpdated: string;
  sections: ApiPatientRecord["sections"];
};

const lower = <T extends string>(value: string) => value.toLowerCase().replace(/_/g, "-") as T;

/** The note a visit is summarised by: its latest consultation note, else its latest note. */
function mainNote(notes: ApiNote[]) {
  const consultation = notes.filter((note) => note.kind === "CONSULTATION");
  return (consultation.length ? consultation : notes).at(-1);
}

function encounterStatus(encounter: ApiRecordEncounter, note: ApiNote | undefined): EncounterStatus {
  if (encounter.status === "CANCELLED") return "cancelled";
  if (note?.amendments.length) return "amended";
  return note?.status === "SIGNED" ? "signed" : "in-progress";
}

function encounterFromApi(encounter: ApiRecordEncounter, record: ApiPatientRecord, medications: LiveRxLine[]): Encounter {
  const note = mainNote(encounter.notes);
  const amendment = note?.amendments.at(-1);
  return {
    id: encounter.id,
    patientId: record.patient.id,
    date: encounter.arrivedAt,
    provider: encounter.attendingName ?? note?.authorName ?? "—",
    complaint: encounter.reason ?? note?.subjective ?? encounter.visitType ?? "Visit",
    examination: note?.objective ?? undefined,
    assessment: note?.assessment ?? undefined,
    plan: note?.plan ?? undefined,
    diagnoses: encounter.diagnoses.map((diagnosis) => ({ code: diagnosis.code, name: diagnosis.description })),
    prescriptions: medications.filter((line) => line.encounterId === encounter.id),
    labs: (record.labs ?? []).filter((order) => order.encounterId === encounter.id).flatMap((order) => order.items.map((item) => item.testName)),
    station: encounter.class === "EMERGENCY" ? "Emergency" : "Consultation",
    status: encounterStatus(encounter, note),
    signedBy: note?.signedByName ?? undefined,
    signedAt: note?.signedAt ?? undefined,
    amendedBy: amendment?.authorName ?? undefined,
    amendedAt: amendment?.createdAt,
    amendmentNote: amendment?.reason,
    visitType: encounter.visitType ?? undefined,
    followUp: note?.followUp ?? undefined,
    patientInstructions: note?.patientInstructions ?? undefined,
    nhmisIndicators: encounter.nhmisIndicators,
  };
}

const conceptFor = (problem: Pick<ApiProblem, "code" | "codeSystem" | "description">): CodeableConcept =>
  problem.codeSystem === "ICD11" ? icd11Concept(problem.code, problem.description) : { system: "local", code: problem.code, display: problem.description };

function conditionFromApi(problem: ApiProblem, patientId: string): LiveCondition {
  return {
    id: problem.id,
    problemId: problem.problemId,
    fromDiagnosisId: problem.fromDiagnosisId,
    version: problem.version,
    patientId,
    code: conceptFor(problem),
    clinicalStatus: lower<ConditionClinicalStatus>(problem.clinicalStatus),
    // A flagged diagnosis has not been verified for the problem list yet.
    verificationStatus: problem.verificationStatus ? lower<ConditionVerificationStatus>(problem.verificationStatus) : "unconfirmed",
    category: "problem-list-item",
    onsetDate: problem.onsetDate ?? undefined,
    abatementDate: problem.abatementDate ?? undefined,
    recordedDate: problem.createdAt,
    recordedBy: problem.recordedByName ?? "Unknown staff member",
    encounterId: problem.encounterId ?? undefined,
    note: problem.note ?? undefined,
  };
}

function allergyFromApi(allergy: ApiRecordAllergy, patientId: string): AllergyIntolerance {
  const known = ALLERGEN_SNOMED[allergy.substance];
  const hasReaction = allergy.manifestations.length > 0 || allergy.reaction;
  return {
    id: allergy.id,
    patientId,
    substance: known ? { system: "snomed", code: known.code, display: allergy.substance } : localConcept(allergy.substance),
    type: "allergy",
    // Entries recorded before these details existed came from prescribing checks (medicines).
    category: allergy.category ? lower(allergy.category) : "medication",
    criticality: allergy.criticality ? lower(allergy.criticality) : "unable-to-assess",
    clinicalStatus: "active",
    verificationStatus: lower(allergy.verificationStatus),
    reactions: hasReaction ? [{ manifestation: allergy.manifestations, severity: lower(allergy.severity), description: allergy.reaction ?? undefined }] : [],
    recordedDate: allergy.createdAt,
    recordedBy: allergy.recordedByName ?? "Unknown staff member",
    note: allergy.note ?? undefined,
    source: allergy.source ?? undefined,
  };
}

const INVOICE_STATUS: Record<ApiRecordInvoice["status"], Invoice["status"]> = { ISSUED: "Unpaid", PARTIALLY_PAID: "Partially Paid", PAID: "Paid", VOID: "Void" };

/** An invoice as the chart's billing history lists it; tax and discount are lines so the amount matches the invoice total. */
function invoiceFromApi(invoice: ApiRecordInvoice, patient: Patient): Invoice {
  return {
    id: invoice.id,
    number: invoice.number,
    patientId: patient.id,
    payer: patient.payer,
    category: patient.category,
    lines: [
      ...invoice.lines.map((line) => ({ code: line.sourceKey ?? line.category, name: line.description, qty: line.quantity, unitPrice: line.unitPriceMinor / 100 })),
      ...(invoice.taxMinor ? [{ code: "TAX", name: "Tax", qty: 1, unitPrice: invoice.taxMinor / 100 }] : []),
      ...(invoice.discountMinor ? [{ code: "DISCOUNT", name: "Discount", qty: 1, unitPrice: -invoice.discountMinor / 100 }] : []),
    ],
    exempt: false,
    createdAt: invoice.issuedAt,
    status: INVOICE_STATUS[invoice.status],
  };
}

export function recordFromApi(record: ApiPatientRecord): LivePatientRecord {
  const patient = patientFromApi(record.patient);
  const medications = (record.prescriptions ?? []).flatMap((rx) => rx.items.map((item) => liveRxLine(rx, item)));
  const open = record.encounters.find((encounter) => (encounter.status === "ARRIVED" || encounter.status === "IN_PROGRESS")
    && (encounter.queueEntry?.status === "WAITING" || encounter.queueEntry?.status === "IN_PROGRESS"));
  const times = [
    record.patient.createdAt ?? "", ...record.encounters.map((e) => e.arrivedAt), ...record.vitals.map((v) => v.recordedAt),
    ...record.problems.map((p) => p.createdAt), ...record.allergies.map((a) => a.createdAt), ...(record.labs ?? []).map((o) => o.createdAt),
  ];
  return {
    patient,
    encounters: record.encounters.map((encounter) => encounterFromApi(encounter, record, medications)),
    labs: (record.labs ?? []).flatMap((order) => order.items.map((item) => liveLabTest(order, item))),
    medications,
    vitals: vitalsSets(record.vitals),
    conditions: record.problems.map((problem) => conditionFromApi(problem, patient.id)),
    allergies: record.allergies.map((allergy) => allergyFromApi(allergy, patient.id)),
    admissions: (record.admissions ?? []).map(liveAdmission),
    invoices: (record.invoices ?? []).map((invoice) => invoiceFromApi(invoice, patient)),
    outstanding: (record.invoices ?? []).reduce((total, invoice) => total + invoice.balanceMinor, 0) / 100,
    inClinic: open?.queueEntry ? { station: open.queueEntry.station as Station, status: STATUS_FROM_API[open.queueEntry.status] } : null,
    lastUpdated: times.reduce((latest, time) => (time > latest ? time : latest), ""),
    sections: record.sections,
  };
}

/** The problem list and allergy codes the API expects. */
const upper = (value: string) => value.toUpperCase().replace(/-/g, "_");
const ALLERGY_CODES: Record<string, string> = { Penicillin: "PENICILLIN", Sulfonamides: "SULFONAMIDE", NSAIDs: "NSAID", Aspirin: "ASPIRIN" };
/** What prescribing checks match an allergy on: a drug class for the common ones, else the name as a code. */
export function allergySubstanceCode(substance: string) {
  const named = ALLERGY_CODES[substance];
  if (named) return named;
  const code = substance.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[0-9_]+/, "").slice(0, 24);
  return code || "OTHER";
}

export type NewProblem = { code: string; description: string; verificationStatus: ConditionVerificationStatus; onsetDate?: string; note?: string };
export type NewAllergy = {
  substance: string; category: string; criticality: string; severity: string; manifestations: string[]; description?: string; source?: string;
};

type RecordState = {
  id: string | null;
  record: LivePatientRecord | null;
  error: string;
  load: (id: string) => Promise<void>;
  addProblem: (problem: NewProblem) => Promise<void>;
  changeProblem: (condition: LiveCondition, change: { clinicalStatus?: ConditionClinicalStatus; verificationStatus?: ConditionVerificationStatus }) => Promise<void>;
  recordAllergy: (allergy: NewAllergy) => Promise<void>;
  confirmAllergy: (allergyId: string) => Promise<void>;
  amendEncounter: (encounterId: string, reason: string) => Promise<void>;
};

let raw: ApiPatientRecord | null = null;

export const useLivePatientRecord = create<RecordState>((set, get) => {
  const patientPath = () => {
    const id = get().id;
    if (!id) throw new Error("No patient is open.");
    return `/patients/${encodeURIComponent(id)}`;
  };
  const reload = async () => { const id = get().id; if (id) await get().load(id); };
  return {
    id: null, record: null, error: "",
    load: async (id) => {
      if (get().id !== id) { raw = null; set({ id, record: null, error: "" }); }
      try {
        const data = await emrRequest<{ data: ApiPatientRecord }>(`/patients/${encodeURIComponent(id)}/record`);
        if (get().id === id) { raw = data.data; set({ record: recordFromApi(data.data), error: "" }); }
      } catch (cause) {
        if (get().id === id) set({ error: cause instanceof Error ? cause.message : "The patient record could not be loaded." });
      }
    },
    addProblem: async (problem) => {
      await emrRequest(`${patientPath()}/problems`, {
        method: "POST",
        body: {
          codeSystem: "ICD11", code: problem.code, description: problem.description, verificationStatus: upper(problem.verificationStatus),
          ...(problem.onsetDate ? { onsetDate: problem.onsetDate } : {}), ...(problem.note ? { note: problem.note } : {}),
        },
      });
      await reload();
    },
    changeProblem: async (condition, change) => {
      const body = {
        ...(change.clinicalStatus ? { clinicalStatus: upper(change.clinicalStatus) } : {}),
        ...(change.verificationStatus ? { verificationStatus: upper(change.verificationStatus) } : {}),
      };
      if (condition.problemId && condition.version) {
        await emrRequest(`${patientPath()}/problems/${condition.problemId}`, { method: "PATCH", version: condition.version, body });
      } else if (condition.fromDiagnosisId) {
        await emrRequest(`${patientPath()}/problems`, { method: "POST", body: { fromDiagnosisId: condition.fromDiagnosisId, ...body } });
      }
      await reload();
    },
    recordAllergy: async (allergy) => {
      const description = allergy.description?.trim();
      await emrRequest(`${patientPath()}/allergies`, {
        method: "POST",
        body: {
          substance: allergy.substance, substanceCode: allergySubstanceCode(allergy.substance),
          category: upper(allergy.category), criticality: upper(allergy.criticality), severity: upper(allergy.severity),
          verificationStatus: "CONFIRMED", manifestations: allergy.manifestations,
          ...(description ? { reaction: description.slice(0, 200) } : {}), ...(allergy.source ? { source: allergy.source } : {}),
        },
      });
      await reload();
    },
    confirmAllergy: async (allergyId) => {
      await emrRequest(`${patientPath()}/allergies/${allergyId}/confirm`, { method: "POST", body: {} });
      await reload();
    },
    amendEncounter: async (encounterId, reason) => {
      const encounter = raw?.encounters.find((entry) => entry.id === encounterId);
      const note = encounter && mainNote(encounter.notes);
      if (!note) throw new Error("This visit has no clinical note to amend.");
      if (note.status !== "SIGNED") throw new Error("This note is still a draft. Edit and sign it in the consultation instead of amending it.");
      await emrRequest(`/encounters/${encounterId}/notes/${note.id}/amendments`, { method: "POST", body: { reason, body: reason } });
      await reload();
    },
  };
});

/** Loads the patient's record when live and the patient changes. */
export function useLivePatientRecordLoad(enabled: boolean, patientId: string | null | undefined) {
  useEffect(() => {
    if (enabled && patientId) void useLivePatientRecord.getState().load(patientId);
  }, [enabled, patientId]);
}
