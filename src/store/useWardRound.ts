import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { useEmr, prescriptionsForPatient } from "@/store/useEmr";
import { useClinical } from "@/store/useClinical";
import { screenPrescription, type SafetyAlert } from "@/data/medicationSafety";
import type { Admission, Patient, Prescription } from "@/data/types";
import {
  EMPTY_SAFETY_CHECKLIST,
  type WardRound,
  type ParticipantRole,
  type WardRoundProblem,
  type ClinicalDevice,
  type ClinicalTask,
  type MedicationChange,
  type MedicationChangeAction,
  type PhysicalExamination,
  type PhysicalExaminationSystem,
  type WardRoundSafetyChecklist,
  type DischargeReadiness,
  type PatientCommunication,
  type WardRoundStatus,
} from "@/data/wardRound";
import { persisted } from "@/platform/persist";

const rid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date();
const nowIso = () => now().toISOString();
const actor = () => useIdentity.getState().user;

const EMPTY_DISCHARGE_READINESS: DischargeReadiness = { fit: null, barriers: [] };
const EMPTY_COMMUNICATION: PatientCommunication = {
  patientUpdated: null,
  medicationChangesExplained: null,
  planDiscussed: null,
  caregiverUpdated: null,
  interpreterRequired: null,
};

export type MedicationChangeInput = {
  patientId: string;
  wardRoundId: string;
  encounterId: string;
  target: Prescription;
  action: MedicationChangeAction;
  newDose?: string;
  newFrequency?: string;
  newRoute?: string;
  reason: string;
  clinicalNote?: string;
  monitoringRequired?: string;
  effectiveAt?: string;
};

export type AddMedicationInput = {
  patientId: string;
  wardRoundId: string;
  encounterId: string;
  drug: string;
  dose: string;
  frequency: string;
  duration: string;
  qty: number;
  route?: string;
  indication?: string;
  specialInstructions?: string;
  monitoringInstructions?: string;
  prn?: boolean;
  prnIndication?: string;
  priority?: Prescription["priority"];
  startedAt?: string;
};

export type RecordExaminationInput = {
  patientId: string;
  encounterId: string;
  wardRoundId?: string;
  systems: PhysicalExaminationSystem[];
};

type WardRoundState = {
  rounds: WardRound[];
  medicationChanges: MedicationChange[];
  examinations: PhysicalExamination[];

  roundsFor: (admissionId: string) => WardRound[];
  latestRoundFor: (admissionId: string) => WardRound | undefined;
  roundById: (id: string) => WardRound | undefined;
  medicationChangesFor: (patientId: string) => MedicationChange[];
  examinationFor: (id?: string) => PhysicalExamination | undefined;

  startRound: (admission: Admission, patient: Patient) => string;
  updateDraft: (id: string, patch: Partial<WardRound>) => void;

  addParticipant: (id: string, role: ParticipantRole, name: string) => void;
  removeParticipant: (id: string, participantId: string) => void;

  addDevice: (id: string, device: Omit<ClinicalDevice, "id">) => void;
  removeDevice: (id: string, deviceId: string) => void;

  addProblem: (id: string, problem: Omit<WardRoundProblem, "id">) => void;
  updateProblem: (id: string, problemId: string, patch: Partial<WardRoundProblem>) => void;
  removeProblem: (id: string, problemId: string) => void;

  addTask: (id: string, task: Omit<ClinicalTask, "id">) => void;
  setTaskStatus: (id: string, taskId: string, status: ClinicalTask["status"]) => void;

  setSafetyChecklist: (id: string, patch: Partial<WardRoundSafetyChecklist>) => void;
  setDischargeReadiness: (id: string, patch: Partial<DischargeReadiness>) => void;
  setCommunication: (id: string, patch: Partial<PatientCommunication>) => void;

  screenNewMedication: (patientId: string, drugName: string) => SafetyAlert[];
  changeMedication: (input: MedicationChangeInput) => { ok: true; medicationChangeId: string } | { ok: false; error: string };
  addMedication: (input: AddMedicationInput) => { ok: true; medicationChangeId: string } | { ok: false; error: string };

  recordExamination: (input: RecordExaminationInput) => string;

  sign: (id: string) => { ok: true } | { ok: false; error: string };
  addAmendment: (id: string, note: string) => { ok: true } | { ok: false; error: string };
};

function activePrescriptionsFor(patientId: string): Prescription[] {
  return prescriptionsForPatient(useEmr.getState().encounters, patientId);
}

export const useWardRound = create<WardRoundState>(persisted<WardRoundState>("ward-round", (set, get) => ({
  rounds: [],
  medicationChanges: [],
  examinations: [],

  roundsFor: (admissionId) =>
    get()
      .rounds.filter((round) => round.admissionId === admissionId)
      .sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt)),

  latestRoundFor: (admissionId) => get().roundsFor(admissionId)[0],

  roundById: (id) => get().rounds.find((round) => round.id === id),

  medicationChangesFor: (patientId) =>
    get()
      .medicationChanges.filter((change) => change.patientId === patientId)
      .sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt)),

  examinationFor: (id) => (id ? get().examinations.find((exam) => exam.id === id) : undefined),

  startRound: (admission, patient) => {
    const who = actor();
    const previous = get().latestRoundFor(admission.id);
    const encounterId = useEmr.getState().createWardRoundEncounter(patient.id, who.name);
    const id = `wr-${rid()}`;
    const timestamp = now();
    const round: WardRound = {
      id,
      patientId: patient.id,
      admissionId: admission.id,
      encounterId,
      roundDate: timestamp.toISOString().slice(0, 10),
      roundTime: timestamp.toTimeString().slice(0, 5),
      clinicianId: who.id,
      clinicianName: who.name,
      clinicianRole: who.role,
      department: admission.service,
      participants: [{ id: `p-${rid()}`, role: "Consultant", name: who.name }],
      clinicalProgress: "",
      progressNote: "",
      devices: [],
      problems: previous ? previous.problems.map((problem) => ({ ...problem, id: `prob-${rid()}` })) : [],
      medicationChangeIds: [],
      safetyChecklist: { ...EMPTY_SAFETY_CHECKLIST },
      dischargeReadiness: { ...EMPTY_DISCHARGE_READINESS },
      communication: { ...EMPTY_COMMUNICATION },
      tasks: [],
      summary: "",
      status: "draft",
      createdBy: who.name,
      createdAt: timestamp.toISOString(),
      amendments: [],
    };
    set((state) => ({ rounds: [round, ...state.rounds] }));
    audit("started ward round", `ward-round/${patient.id}`, { meta: { admissionId: admission.id, wardRoundId: id } });
    return id;
  },

  updateDraft: (id, patch) => {
    const who = actor();
    set((state) => ({
      rounds: state.rounds.map((round) =>
        round.id === id && round.status === "draft"
          ? { ...round, ...patch, updatedBy: who.name, updatedAt: nowIso() }
          : round,
      ),
    }));
  },

  addParticipant: (id, role, name) => {
    set((state) => ({
      rounds: state.rounds.map((round) =>
        round.id === id ? { ...round, participants: [...round.participants, { id: `p-${rid()}`, role, name }] } : round,
      ),
    }));
  },

  removeParticipant: (id, participantId) => {
    set((state) => ({
      rounds: state.rounds.map((round) =>
        round.id === id ? { ...round, participants: round.participants.filter((p) => p.id !== participantId) } : round,
      ),
    }));
  },

  addDevice: (id, device) => {
    set((state) => ({
      rounds: state.rounds.map((round) =>
        round.id === id ? { ...round, devices: [...round.devices, { ...device, id: `dev-${rid()}` }] } : round,
      ),
    }));
  },

  removeDevice: (id, deviceId) => {
    set((state) => ({
      rounds: state.rounds.map((round) =>
        round.id === id ? { ...round, devices: round.devices.filter((d) => d.id !== deviceId) } : round,
      ),
    }));
  },

  addProblem: (id, problem) => {
    set((state) => ({
      rounds: state.rounds.map((round) =>
        round.id === id ? { ...round, problems: [...round.problems, { ...problem, id: `prob-${rid()}` }] } : round,
      ),
    }));
  },

  updateProblem: (id, problemId, patch) => {
    set((state) => ({
      rounds: state.rounds.map((round) =>
        round.id === id
          ? { ...round, problems: round.problems.map((p) => (p.id === problemId ? { ...p, ...patch } : p)) }
          : round,
      ),
    }));
  },

  removeProblem: (id, problemId) => {
    set((state) => ({
      rounds: state.rounds.map((round) =>
        round.id === id ? { ...round, problems: round.problems.filter((p) => p.id !== problemId) } : round,
      ),
    }));
  },

  addTask: (id, task) => {
    set((state) => ({
      rounds: state.rounds.map((round) =>
        round.id === id ? { ...round, tasks: [...round.tasks, { ...task, id: `task-${rid()}` }] } : round,
      ),
    }));
  },

  setTaskStatus: (id, taskId, status) => {
    set((state) => ({
      rounds: state.rounds.map((round) =>
        round.id === id ? { ...round, tasks: round.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)) } : round,
      ),
    }));
    audit(`clinical task ${status.toLowerCase()}`, `ward-round/${id}/task/${taskId}`);
  },

  setSafetyChecklist: (id, patch) => {
    set((state) => ({
      rounds: state.rounds.map((round) =>
        round.id === id ? { ...round, safetyChecklist: { ...round.safetyChecklist, ...patch } } : round,
      ),
    }));
  },

  setDischargeReadiness: (id, patch) => {
    set((state) => ({
      rounds: state.rounds.map((round) =>
        round.id === id ? { ...round, dischargeReadiness: { ...round.dischargeReadiness, ...patch } } : round,
      ),
    }));
  },

  setCommunication: (id, patch) => {
    set((state) => ({
      rounds: state.rounds.map((round) =>
        round.id === id ? { ...round, communication: { ...round.communication, ...patch } } : round,
      ),
    }));
  },

  screenNewMedication: (patientId, drugName) => {
    const patient = useEmr.getState().patientById(patientId);
    return screenPrescription({
      drugName,
      allergies: useClinical.getState().allergiesFor(patient),
      activePrescriptions: activePrescriptionsFor(patientId).map((p) => ({ drug: p.drug, status: p.status })),
    });
  },

  changeMedication: (input) => {
    if (!input.reason.trim()) return { ok: false, error: "A reason is required for this medication change." };
    const who = actor();
    const effectiveAt = input.effectiveAt ?? nowIso();
    const target = input.target;

    const createsReplacement = ["DOSE_INCREASED", "DOSE_DECREASED", "FREQUENCY_CHANGED", "ROUTE_CHANGED", "REPLACED", "RESTARTED"].includes(
      input.action,
    );
    // the old row is never mutated in place — only its status changes, preserving its
    // original dose/frequency/route exactly as it was prescribed.
    const oldStatus: Prescription["status"] = input.action === "HELD" ? "Held" : input.action === "STOPPED" ? "Stopped" : "Replaced";
    useEmr.getState().setPrescriptionStatus(input.encounterId, target.id, oldStatus);

    let medicationOrderId = target.id;
    if (createsReplacement) {
      const replacement: Prescription = {
        ...target,
        id: `rx-${rid()}`,
        dose: input.newDose ?? target.dose,
        frequency: input.newFrequency ?? target.frequency,
        route: input.newRoute ?? target.route,
        status: "Dispensed",
        startedAt: effectiveAt,
        prescribedBy: who.name,
        replacesId: target.id,
        dispensedQty: undefined,
        dispensedBy: undefined,
        dispensedAt: undefined,
        refusalReason: undefined,
        overrideReason: undefined,
      };
      useEmr.getState().appendPrescriptions(input.encounterId, [replacement]);
      medicationOrderId = replacement.id;
    }

    const changeId = `mc-${rid()}`;
    const change: MedicationChange = {
      id: changeId,
      patientId: input.patientId,
      encounterId: input.encounterId,
      wardRoundId: input.wardRoundId,
      medicationOrderId,
      previousPrescriptionId: target.id,
      drug: target.drug,
      action: input.action,
      previousDose: target.dose,
      previousFrequency: target.frequency,
      previousRoute: target.route,
      newDose: input.newDose,
      newFrequency: input.newFrequency,
      newRoute: input.newRoute,
      reason: input.reason,
      clinicalNote: input.clinicalNote,
      monitoringRequired: input.monitoringRequired,
      effectiveAt,
      clinicianId: who.id,
      clinicianName: who.name,
      createdAt: nowIso(),
    };
    set((state) => ({ medicationChanges: [change, ...state.medicationChanges] }));
    set((state) => ({
      rounds: state.rounds.map((round) =>
        round.id === input.wardRoundId ? { ...round, medicationChangeIds: [...round.medicationChangeIds, changeId] } : round,
      ),
    }));
    audit(`medication ${input.action.toLowerCase().replace(/_/g, " ")} — ${target.drug}`, `ward-round/${input.wardRoundId}/medication`, {
      meta: { reason: input.reason, previousDose: target.dose, newDose: input.newDose },
    });
    return { ok: true, medicationChangeId: changeId };
  },

  addMedication: (input) => {
    if (!input.drug.trim()) return { ok: false, error: "A drug name is required." };
    const who = actor();
    const startedAt = input.startedAt ?? nowIso();
    const prescription: Prescription = {
      id: `rx-${rid()}`,
      drug: input.drug,
      dose: input.dose,
      frequency: input.frequency,
      duration: input.duration,
      qty: input.qty,
      route: input.route,
      indication: input.indication,
      specialInstructions: input.specialInstructions,
      monitoringInstructions: input.monitoringInstructions,
      prn: input.prn,
      prnIndication: input.prnIndication,
      priority: input.priority ?? "Routine",
      status: "Dispensed",
      startedAt,
      prescribedBy: who.name,
    };
    useEmr.getState().appendPrescriptions(input.encounterId, [prescription]);

    const changeId = `mc-${rid()}`;
    const change: MedicationChange = {
      id: changeId,
      patientId: input.patientId,
      encounterId: input.encounterId,
      wardRoundId: input.wardRoundId,
      medicationOrderId: prescription.id,
      drug: input.drug,
      action: "STARTED",
      newDose: input.dose,
      newFrequency: input.frequency,
      newRoute: input.route,
      reason: input.indication ?? "New medication started during ward round",
      effectiveAt: startedAt,
      clinicianId: who.id,
      clinicianName: who.name,
      createdAt: nowIso(),
    };
    set((state) => ({ medicationChanges: [change, ...state.medicationChanges] }));
    set((state) => ({
      rounds: state.rounds.map((round) =>
        round.id === input.wardRoundId ? { ...round, medicationChangeIds: [...round.medicationChangeIds, changeId] } : round,
      ),
    }));
    audit(`medication started — ${input.drug}`, `ward-round/${input.wardRoundId}/medication`, { meta: { dose: input.dose } });
    return { ok: true, medicationChangeId: changeId };
  },

  recordExamination: (input) => {
    const who = actor();
    const id = `exam-${rid()}`;
    const examination: PhysicalExamination = {
      id,
      patientId: input.patientId,
      encounterId: input.encounterId,
      wardRoundId: input.wardRoundId,
      recordedBy: who.name,
      recordedAt: nowIso(),
      systems: input.systems,
    };
    set((state) => ({ examinations: [examination, ...state.examinations] }));
    if (input.wardRoundId) {
      set((state) => ({
        rounds: state.rounds.map((round) => (round.id === input.wardRoundId ? { ...round, examinationId: id } : round)),
      }));
    }
    audit("recorded physical examination", `clinical/examination/${input.patientId}`, {
      meta: { encounterId: input.encounterId, systemCount: input.systems.length },
    });
    return id;
  },

  sign: (id) => {
    const round = get().roundById(id);
    if (!round) return { ok: false, error: "Ward round not found." };
    if (round.status !== "draft") return { ok: false, error: "This ward round has already been signed." };
    if (!round.progressNote.trim()) return { ok: false, error: "Clinical progress note is required before signing." };
    if (round.problems.length === 0 && round.tasks.length === 0) {
      return { ok: false, error: "Add at least one problem/assessment or plan item before signing." };
    }
    const who = actor();
    const signedAt = nowIso();
    const summary = buildSummary(round);
    useEmr.getState().signEncounterById(round.encounterId, who.name);
    set((state) => ({
      rounds: state.rounds.map((r) => (r.id === id ? { ...r, status: "signed" as WardRoundStatus, signedBy: who.name, signedAt, summary } : r)),
    }));
    audit("signed ward round", `ward-round/${id}`, { meta: { patientId: round.patientId, admissionId: round.admissionId } });
    return { ok: true };
  },

  addAmendment: (id, note) => {
    if (!note.trim()) return { ok: false, error: "An amendment note is required." };
    const round = get().roundById(id);
    if (!round) return { ok: false, error: "Ward round not found." };
    if (round.status === "draft") return { ok: false, error: "Only a signed ward round can be amended." };
    const who = actor();
    const amendment = { id: `amd-${rid()}`, note, by: who.name, at: nowIso() };
    set((state) => ({
      rounds: state.rounds.map((r) =>
        r.id === id ? { ...r, status: "amended" as WardRoundStatus, amendments: [...r.amendments, amendment] } : r,
      ),
    }));
    audit("amended ward round", `ward-round/${id}`, { meta: { note } });
    return { ok: true };
  },
})));

/** never invents clinical content — concatenates only what the clinician entered */
export function buildSummary(round: WardRound): string {
  const lines: string[] = [];
  lines.push(`Ward round — ${round.roundDate} ${round.roundTime} — ${round.clinicianName} (${round.clinicianRole})`);
  if (round.clinicalProgress) lines.push(`Progress: ${round.clinicalProgress}`);
  if (round.progressNote) lines.push(round.progressNote);
  if (round.problems.length) {
    lines.push("Problems:");
    for (const problem of round.problems) lines.push(`- ${problem.problem} (${problem.status}): ${problem.plan}`);
  }
  if (round.tasks.length) {
    lines.push("Plan:");
    for (const task of round.tasks) lines.push(`- [${task.type}] ${task.description}`);
  }
  return lines.join("\n");
}
