import { useEffect } from "react";
import { create } from "zustand";
import type { Condition } from "@/data/clinical";
import type { NursingObservation } from "@/data/nursing";
import type { ImagingStudy } from "@/data/radiology";
import type { LabOrder, Patient, Prescription } from "@/data/types";
import type { MedicationChange, PhysicalExamination, WardRound } from "@/data/wardRound";
import type { useWardRound } from "@/store/useWardRound";
import { liveChange, uuid } from "@/workforce-live/sync";
import { emrRequest } from "./client";
import { prescriptionLine } from "./consultation";
import { flowsheetRows, liveAdmission, type LiveAdmission } from "./inpatient";
import { recordFromApi, type ApiPatientRecord } from "./patientRecord";

// The ward round screen for a live hospital (GET /admissions/:id/ward-rounds and the stay's chart): the
// admission, its rounds, medication decisions, the nursing flowsheet, the medication chart and the
// patient's record, with the same actions the screen offers. Typing in a draft is saved a moment after
// it stops (only the fields that changed, against the version read when sending); a reload never
// overwrites what has not been sent yet. Medication decisions act on the real prescriptions on the server,
// which runs the prescribing safety checks — a refusal shows in the banner.

type ApiAdmission = Parameters<typeof liveAdmission>[0];
type ApiVital = Parameters<typeof flowsheetRows>[2][number];
type ApiNursing = Parameters<typeof flowsheetRows>[3][number];
type ApiRound = Omit<WardRound, "roundDate" | "roundTime" | "clinicianId" | "clinicianRole" | "medicationChangeIds" | "examinationId" | "createdBy" | "escalationPlan"> & {
  roundAt: string; clinicianUserId: string; escalationPlan: string | null; version: number;
  examination: { systems: PhysicalExamination["systems"]; recordedBy?: string; recordedAt: string } | null;
};
type ApiChange = {
  id: string; patientId: string; encounterId: string; wardRoundId: string | null; prescriptionItemId: string | null; replacementPrescriptionId: string | null; drugName: string;
  action: MedicationChange["action"]; previousDose: string | null; previousFrequency: string | null; previousRoute: string | null; newDose: string | null; newFrequency: string | null;
  newRoute: string | null; reason: string; clinicalNote: string | null; monitoringRequired: string | null; effectiveAt: string; clinicianUserId: string; clinicianName?: string; createdAt: string;
};
type WardRoundActions = ReturnType<typeof useWardRound.getState>;
export type LiveWardRoundRound = WardRound & { version: number };

const DRAFT_FIELDS = ["participants", "clinicalProgress", "progressNote", "devices", "problems", "tasks", "safetyChecklist", "escalationPlan", "dischargeReadiness", "communication"] as const;
type DraftField = (typeof DRAFT_FIELDS)[number];
const SAVE_DELAY_MS = 600;
const ROUTES: Record<string, string> = {
  oral: "PO", po: "PO", sublingual: "SL", sl: "SL", iv: "IV", intravenous: "IV", im: "IM", intramuscular: "IM", sc: "SC", subcutaneous: "SC", inhaled: "INHALED", inhalation: "INHALED",
  topical: "TOPICAL", rectal: "PR", pr: "PR", vaginal: "PV", pv: "PV", ophthalmic: "OPHTHALMIC", eye: "OPHTHALMIC", otic: "OTIC", ear: "OTIC", nasal: "NASAL",
};
const FREQUENCIES = ["OD", "MANE", "NOCTE", "BD", "TDS", "QDS", "Q4H", "Q6H", "Q8H", "Q12H", "WEEKLY", "STAT", "PRN"];
const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const nn = <T,>(v: T | null | undefined) => v ?? undefined;

/** A route as the formulary codes it ("Oral" → PO); unknown words are refused with the choices. */
export function routeCode(route: string, drug: string) {
  const code = ROUTES[route.trim().toLowerCase()] ?? route.trim().toUpperCase();
  if (!Object.values(ROUTES).includes(code)) throw new Error(`${drug}: route must be one of oral, IV, IM, SC, sublingual, inhaled, topical, rectal, vaginal, eye, ear or nasal.`);
  return code;
}
function doseNumber(text: string, unit: string, drug: string) {
  const m = /^(\d+(?:\.\d+)?)\s*([^\d\s].*)?$/.exec(text.trim());
  if (!m) throw new Error(`${drug}: write the new dose as a number, e.g. 10 ${unit}.`);
  if (m[2] && m[2].trim().toLowerCase() !== unit.toLowerCase()) throw new Error(`${drug}: the dose must be in ${unit}.`);
  return Number(m[1]);
}
function frequencyCode(text: string, drug: string) {
  const code = text.trim().split(/\s+/)[0]?.toUpperCase();
  if (!code || !FREQUENCIES.includes(code)) throw new Error(`${drug}: frequency must be one of ${FREQUENCIES.join(", ")}.`);
  return code;
}

export function roundFromApi(r: ApiRound, changes: ApiChange[]): LiveWardRoundRound {
  return {
    id: r.id, patientId: r.patientId, admissionId: r.admissionId, encounterId: r.encounterId, roundDate: r.roundAt.slice(0, 10), roundTime: hhmm(r.roundAt),
    clinicianId: r.clinicianUserId, clinicianName: r.clinicianName ?? "Clinician", clinicianRole: "Clinician", department: nn(r.department),
    participants: r.participants, clinicalProgress: r.clinicalProgress ?? "", progressNote: r.progressNote, devices: r.devices, problems: r.problems,
    medicationChangeIds: changes.filter((c) => c.wardRoundId === r.id).map((c) => c.id), examinationId: r.examination ? `exam-${r.id}` : undefined,
    safetyChecklist: r.safetyChecklist, escalationPlan: nn(r.escalationPlan), dischargeReadiness: r.dischargeReadiness, communication: r.communication, tasks: r.tasks,
    summary: r.summary, status: r.status, createdBy: r.clinicianName ?? "Clinician", createdAt: r.createdAt, updatedBy: nn(r.updatedBy), updatedAt: nn(r.updatedAt),
    signedBy: nn(r.signedBy), signedAt: nn(r.signedAt), amendments: r.amendments, version: r.version,
  };
}
export const changeFromApi = (c: ApiChange): MedicationChange => ({
  id: c.id, patientId: c.patientId, encounterId: c.encounterId, wardRoundId: nn(c.wardRoundId), medicationOrderId: c.replacementPrescriptionId ?? c.prescriptionItemId ?? c.id,
  previousPrescriptionId: nn(c.prescriptionItemId), drug: c.drugName, action: c.action, previousDose: nn(c.previousDose), previousFrequency: nn(c.previousFrequency),
  previousRoute: nn(c.previousRoute), newDose: nn(c.newDose), newFrequency: nn(c.newFrequency), newRoute: nn(c.newRoute), reason: c.reason, clinicalNote: nn(c.clinicalNote),
  monitoringRequired: nn(c.monitoringRequired), effectiveAt: c.effectiveAt, clinicianId: c.clinicianUserId, clinicianName: c.clinicianName ?? "Clinician", createdAt: c.createdAt,
});

type LiveWardRoundState = {
  admissionId: string | null;
  loaded: boolean;
  error: string;
  admission?: LiveAdmission;
  patient?: Patient;
  rounds: LiveWardRoundRound[];
  changes: MedicationChange[];
  examinations: PhysicalExamination[];
  observations: NursingObservation[];
  conditions: Condition[];
  labs: LabOrder[];
  imaging: ImagingStudy[];
  medications: Prescription[];
  lastGiven: Record<string, string>;
  load: (admissionId: string) => Promise<void>;
};

// fields typed but not yet sent, per round
const pending = new Map<string, Partial<Pick<WardRound, DraftField>>>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const overlay = (r: LiveWardRoundRound): LiveWardRoundRound => ({ ...r, ...(pending.get(r.id) ?? {}) });

export const useLiveWardRound = create<LiveWardRoundState>((set, get) => ({
  admissionId: null, loaded: false, error: "", rounds: [], changes: [], examinations: [], observations: [], conditions: [], labs: [], imaging: [], medications: [], lastGiven: {},
  load: async (admissionId) => {
    if (get().admissionId !== admissionId) set({ admissionId, loaded: false, error: "", admission: undefined, patient: undefined, rounds: [] });
    try {
      const [admissionRes, roundsRes, marRes] = await Promise.all([
        emrRequest<{ data: ApiAdmission }>(`/admissions/${admissionId}`),
        emrRequest<{ data: { rounds: ApiRound[]; medicationChanges: ApiChange[] } }>(`/admissions/${admissionId}/ward-rounds`),
        emrRequest<{ data: { medicines: { prescriptionItemId: string; lastGivenAt: string | null }[] } }>(`/admissions/${admissionId}/mar`),
      ]);
      const admission = liveAdmission(admissionRes.data);
      const [vitals, nursing, record] = await Promise.all([
        emrRequest<{ data: { items: ApiVital[] } }>(`/encounters/${admission.encounterId}/vitals`),
        emrRequest<{ data: { items: ApiNursing[] } }>(`/admissions/${admissionId}/nursing`),
        emrRequest<{ data: ApiPatientRecord }>(`/patients/${admission.patientId}/record`),
      ]);
      if (get().admissionId !== admissionId) return;
      const { rounds, medicationChanges } = roundsRes.data;
      const live = recordFromApi(record.data);
      set({
        loaded: true, error: "", admission, patient: admission.patient,
        rounds: rounds.map((r) => overlay(roundFromApi(r, medicationChanges))),
        changes: medicationChanges.map(changeFromApi),
        examinations: rounds.filter((r) => r.examination).map((r) => ({
          id: `exam-${r.id}`, patientId: r.patientId, encounterId: r.encounterId, wardRoundId: r.id, recordedBy: r.examination?.recordedBy ?? "Clinician",
          recordedAt: r.examination?.recordedAt ?? r.createdAt, systems: r.examination?.systems ?? [],
        })),
        observations: flowsheetRows(admissionId, admission.patientId, vitals.data.items, nursing.data.items),
        conditions: live.conditions, labs: live.labs, imaging: live.imaging, medications: live.medications,
        lastGiven: Object.fromEntries(marRes.data.medicines.filter((m) => m.lastGivenAt).map((m) => [m.prescriptionItemId, m.lastGivenAt as string])),
      });
    } catch (cause) {
      if (get().admissionId === admissionId) set({ loaded: true, error: cause instanceof Error ? cause.message : "This ward round could not be loaded." });
    }
  },
}));

const S = () => useLiveWardRound.getState();
const reload = async () => { const id = S().admissionId; if (id) await S().load(id); };
const roundOf = (id: string) => S().rounds.find((r) => r.id === id);

/** Sends what was typed in a draft (queued behind any change already on its way). */
function flush(id: string) {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  if (!pending.get(id)) return;
  void liveChange(async () => {
    const fields = pending.get(id);
    pending.delete(id);
    if (!fields) return;
    // the version as it is now (after any save before this one reloaded it)
    await emrRequest(`/ward-rounds/${id}`, { method: "PATCH", version: roundOf(id)?.version ?? 1, body: fields });
  }, reload);
}
function edit(id: string, change: (r: LiveWardRoundRound) => Partial<Pick<WardRound, DraftField>>) {
  const round = roundOf(id);
  if (!round || round.status !== "draft") return;
  const fields = change(round);
  pending.set(id, { ...(pending.get(id) ?? {}), ...fields });
  useLiveWardRound.setState((s) => ({ rounds: s.rounds.map((r) => (r.id === id ? { ...r, ...fields } : r)) }));
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.set(id, setTimeout(() => flush(id), SAVE_DELAY_MS));
}
const post = (path: string, body: unknown = {}) => emrRequest(path, { method: "POST", body });
const rid = () => uuid().slice(0, 8);

/** The ward round screen's actions against the live hospital — the same names as the demo store. */
export const liveWardRoundActions: Pick<WardRoundActions,
  | "roundsFor" | "latestRoundFor" | "roundById" | "medicationChangesFor" | "examinationFor" | "startRound" | "updateDraft" | "addParticipant" | "removeParticipant"
  | "addDevice" | "removeDevice" | "addProblem" | "updateProblem" | "removeProblem" | "addTask" | "setTaskStatus" | "setSafetyChecklist" | "setDischargeReadiness"
  | "setCommunication" | "screenNewMedication" | "changeMedication" | "addMedication" | "recordExamination" | "sign" | "addAmendment"> = {
  roundsFor: (admissionId) => S().rounds.filter((r) => r.admissionId === admissionId),
  latestRoundFor: (admissionId) => S().rounds.find((r) => r.admissionId === admissionId),
  roundById: (id) => roundOf(id),
  medicationChangesFor: (patientId) => S().changes.filter((c) => c.patientId === patientId),
  examinationFor: (id) => (id ? S().examinations.find((e) => e.id === id) : undefined),

  startRound: (admission) => {
    const id = uuid();
    void liveChange(() => post(`/admissions/${admission.id}/ward-rounds`, { id }), reload);
    return id;
  },
  updateDraft: (id, patch) => edit(id, () => Object.fromEntries(DRAFT_FIELDS.filter((k) => patch[k] !== undefined).map((k) => [k, patch[k]]))),
  addParticipant: (id, role, name) => edit(id, (r) => ({ participants: [...r.participants, { id: `p-${rid()}`, role, name }] })),
  removeParticipant: (id, participantId) => edit(id, (r) => ({ participants: r.participants.filter((p) => p.id !== participantId) })),
  addDevice: (id, device) => edit(id, (r) => ({ devices: [...r.devices, { ...device, id: `dev-${rid()}` }] })),
  removeDevice: (id, deviceId) => edit(id, (r) => ({ devices: r.devices.filter((d) => d.id !== deviceId) })),
  addProblem: (id, problem) => edit(id, (r) => ({ problems: [...r.problems, { ...problem, id: `prob-${rid()}` }] })),
  updateProblem: (id, problemId, patch) => edit(id, (r) => ({ problems: r.problems.map((p) => (p.id === problemId ? { ...p, ...patch } : p)) })),
  removeProblem: (id, problemId) => edit(id, (r) => ({ problems: r.problems.filter((p) => p.id !== problemId) })),
  addTask: (id, task) => edit(id, (r) => ({ tasks: [...r.tasks, { ...task, id: `task-${rid()}` }] })),
  setTaskStatus: (id, taskId, status) => edit(id, (r) => ({ tasks: r.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)) })),
  setSafetyChecklist: (id, patch) => edit(id, (r) => ({ safetyChecklist: { ...r.safetyChecklist, ...patch } })),
  setDischargeReadiness: (id, patch) => edit(id, (r) => ({ dischargeReadiness: { ...r.dischargeReadiness, ...patch } })),
  setCommunication: (id, patch) => edit(id, (r) => ({ communication: { ...r.communication, ...patch } })),

  // the server screens every new prescription (allergy, maximum dose, duplicate therapy) when it is sent
  screenNewMedication: () => [],

  changeMedication: (input) => {
    if (!input.reason.trim()) return { ok: false, error: "A reason is required for this medication change." };
    flush(input.wardRoundId);
    const target = input.target as Prescription & { itemId?: string; doseUnit?: string };
    void liveChange(async () => {
      const drug = target.drug;
      const unit = target.doseUnit ?? target.dose.replace(/^[\d.\s]+/, "");
      await post(`/ward-rounds/${input.wardRoundId}/medication-changes`, {
        prescriptionItemId: target.itemId ?? target.id, action: input.action, reason: input.reason.trim(),
        ...(input.newDose !== undefined ? { newDose: doseNumber(input.newDose, unit, drug) } : {}),
        ...(input.newFrequency !== undefined ? { newFrequency: frequencyCode(input.newFrequency, drug) } : {}),
        ...(input.newRoute !== undefined ? { newRoute: routeCode(input.newRoute, drug) } : {}),
        ...(input.clinicalNote ? { clinicalNote: input.clinicalNote } : {}),
        ...(input.monitoringRequired ? { monitoringRequired: input.monitoringRequired } : {}),
      });
    }, reload);
    return { ok: true, medicationChangeId: "" };
  },
  addMedication: (input) => {
    if (!input.drug.trim()) return { ok: false, error: "A drug name is required." };
    flush(input.wardRoundId);
    const product = input as typeof input & { drugCode?: string; doseUnit?: string };
    void liveChange(async () => {
      // the same rules as prescribing in the consultation room (a formulary pick, dose in its unit, a frequency code)
      const line = prescriptionLine({ id: "", drug: input.drug, drugCode: product.drugCode, doseUnit: product.doseUnit, dose: input.dose, frequency: input.prn ? `PRN ${input.prnIndication ?? ""}`.trim() : input.frequency, duration: input.duration, qty: input.qty > 1 ? input.qty : 0 } as Prescription);
      const instructions = [input.specialInstructions, input.monitoringInstructions].filter(Boolean).join(" · ");
      await post(`/ward-rounds/${input.wardRoundId}/medications`, {
        ...line, ...(input.route ? { route: routeCode(input.route, input.drug) } : {}), ...(instructions ? { instructions: instructions.slice(0, 500) } : {}),
        ...(input.indication ? { indication: input.indication } : {}),
      });
    }, reload);
    return { ok: true, medicationChangeId: "" };
  },
  recordExamination: (input) => {
    const id = input.wardRoundId ?? "";
    flush(id);
    void liveChange(() => post(`/ward-rounds/${id}/examination`, { systems: input.systems }), reload);
    return `exam-${id}`;
  },
  sign: (id) => {
    const round = roundOf(id);
    if (!round) return { ok: false, error: "Ward round not found." };
    if (round.status !== "draft") return { ok: false, error: "This ward round has already been signed." };
    if (!round.progressNote.trim()) return { ok: false, error: "Clinical progress note is required before signing." };
    if (round.problems.length === 0 && round.tasks.length === 0) return { ok: false, error: "Add at least one problem/assessment or plan item before signing." };
    flush(id);
    void liveChange(() => post(`/ward-rounds/${id}/sign`), reload);
    return { ok: true };
  },
  addAmendment: (id, note) => {
    if (!note.trim()) return { ok: false, error: "An amendment note is required." };
    const round = roundOf(id);
    if (!round) return { ok: false, error: "Ward round not found." };
    if (round.status === "draft") return { ok: false, error: "Only a signed ward round can be amended." };
    void liveChange(() => post(`/ward-rounds/${id}/amendments`, { note: note.trim() }), reload);
    return { ok: true };
  },
};

/** Loads the admission's ward round workspace while the live screen is open. */
export function useLiveWardRoundLoad(admissionId: string | undefined) {
  useEffect(() => {
    if (admissionId) void useLiveWardRound.getState().load(admissionId);
  }, [admissionId]);
}
