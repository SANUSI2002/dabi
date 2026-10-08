import { useEffect } from "react";
import { create } from "zustand";
import type { Admission, Patient } from "@/data/types";
import type { Bed, Ward } from "@/data/wards";
import type { NursingObservation } from "@/data/nursing";
import type { MarSlot } from "@/store/useNursing";
import { emrRequest, newIdempotencyKey } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";
import { vitalsReadings, type VitalsForm } from "./vitals";
import { useLiveEmr } from "./session";

// The hospital's wards for the live In-patient Care screen: the census (admissions with their
// ward details), the bed board, each stay's nursing flowsheet (vital signs on the visit + nursing
// findings on the stay) and its medication chart. Every change goes to the server and the data is
// reloaded from it.

const REFRESH_MS = 60_000;

type ApiPlace = { ward: { code: string; name: string }; bed: { code: string } };
type ApiAdmission = ApiPlace & {
  id: string; encounterId: string; patientId: string; status: "ADMITTED" | "DISCHARGED" | "CANCELLED"; wardId: string; bedId: string; version: number;
  reason: string; admittedAt: string; attendingUserId: string | null; attendingName: string | null; expectedDischargeDate: string | null;
  admittingDiagnosis: string | null; service: string | null; isolation: string | null; dischargeReady: boolean;
  dischargedAt: string | null; dischargedByName: string | null; dischargeOutcome: string | null; dischargeDisposition: string | null;
  dischargeDestination: string | null; dischargeSummary: string | null; lastObservedAt: string | null;
  patient: Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex">;
  assignments: Array<ApiPlace & { reason: string; note: string | null; startedAt: string }>;
};
type ApiWard = { id: string; code: string; name: string; kind: string; genderRestriction: string; active: boolean; version: number };
type ApiBed = { id: string; code: string; status: "AVAILABLE" | "OCCUPIED" | "CLEANING" | "OUT_OF_SERVICE"; statusReason: string | null; version: number };
type ApiMedicine = {
  prescriptionItemId: string; drugName: string; strength: string; dose: number; doseUnit: string; frequency: string; route: string;
  prn: boolean; controlled: boolean; lastGivenAt: string | null; nextAllowedAt: string | null;
};
type ApiMarEntry = {
  id: string; prescriptionItemId: string; status: "GIVEN" | "HELD" | "REFUSED" | "MISSED"; dose: number | null; doseUnit: string | null;
  administeredAt: string; administeredByName: string | null; witnessName: string | null; reason: string | null; entryStatus: "ACTIVE" | "ENTERED_IN_ERROR";
};
type ApiObservation = { code: string; value: number; recordedAt: string; recordedByName: string | null; status: string };
type ApiNursing = {
  id: string; recordedAt: string; recordedByName: string | null; fluidIntakeMl: number | null; fluidOutputMl: number | null;
  mobility: string | null; fallsRisk: "Low" | "Moderate" | "High" | null; pressureRisk: "Low" | "Moderate" | "High" | null; note: string | null;
};

export type LiveAdmission = Admission & { version: number; encounterId: string; wardId: string; bedId: string; patient: Patient; lastObservedAt: string | null };
export type LiveWard = Ward & { code: string; kind: string; version: number };
export type LiveBed = Bed & { status: ApiBed["status"]; version: number };
/** A chart row; `itemId`, `plannedDose` and `controlled` let live actions chart it. */
export type LiveMarSlot = MarSlot & { itemId: string; controlled: boolean; plannedDose?: { dose: number; doseUnit: string; route: string } };

export const WARD_KIND_LABEL: Record<string, string> = {
  GENERAL: "General", SURGICAL: "Surgical", MATERNITY: "Maternity", PAEDIATRIC: "Paediatric", ICU: "ICU", HDU: "HDU", ISOLATION: "Isolation", PRIVATE: "Private", OTHER: "Other",
};

/** The ward's outcome labels and the coded disposition each one is. */
export const DISPOSITION_FOR_OUTCOME: Record<string, string> = {
  Recovered: "HOME", Improved: "HOME", "Referred to higher level": "TRANSFERRED_OUT", "Discharged against advice": "AGAINST_MEDICAL_ADVICE", Absconded: "OTHER", Died: "DECEASED",
};
const OUTCOME_FOR_DISPOSITION: Record<string, string> = {
  HOME: "Discharged home", TRANSFERRED_OUT: "Referred to higher level", AGAINST_MEDICAL_ADVICE: "Discharged against advice", DECEASED: "Died", OTHER: "Other",
};

export function liveAdmission(row: ApiAdmission): LiveAdmission {
  return {
    id: row.id,
    version: row.version,
    encounterId: row.encounterId,
    wardId: row.wardId,
    bedId: row.bedId,
    patientId: row.patientId,
    patient: patientFromApi(row.patient),
    ward: row.ward.name,
    bed: row.bed.code,
    diagnosis: row.admittingDiagnosis ?? row.reason,
    reason: row.admittingDiagnosis ? row.reason : undefined,
    admittedAt: row.admittedAt,
    status: row.status === "ADMITTED" ? "Active" : "Discharged",
    outcome: row.dischargeOutcome ?? (row.dischargeDisposition ? OUTCOME_FOR_DISPOSITION[row.dischargeDisposition] : undefined),
    admittingClinician: row.attendingName ?? undefined,
    service: row.service ?? undefined,
    isolation: row.isolation ?? undefined,
    expectedDischarge: row.expectedDischargeDate ?? undefined,
    dischargeReady: row.dischargeReady,
    bedHistory: row.assignments.map((move) => ({ ward: move.ward.name, bed: move.bed.code, from: move.startedAt, reason: move.note ?? undefined })),
    dischargedAt: row.dischargedAt ?? undefined,
    dischargedBy: row.dischargedByName ?? undefined,
    dischargeDestination: row.dischargeDestination ?? undefined,
    dischargeSummary: row.dischargeSummary ?? undefined,
    lastObservedAt: row.lastObservedAt,
  };
}

const DUE_WINDOW_MS = 30 * 60_000;
const ENTRY_STATUS: Record<ApiMarEntry["status"], MarSlot["status"]> = { GIVEN: "given", HELD: "held", REFUSED: "refused", MISSED: "omitted" };

/** The chart as rows: each medicine's next dose (due, or scheduled for when it is allowed), then what was charted. */
export function marSlots(medicines: ApiMedicine[], entries: ApiMarEntry[], now = Date.now()): LiveMarSlot[] {
  const next = medicines.map((m): LiveMarSlot => {
    const allowed = m.nextAllowedAt ? new Date(m.nextAllowedAt).getTime() : now;
    return {
      slotKey: `${m.prescriptionItemId}:next${m.prn ? ":prn" : ""}`,
      prescriptionId: m.prescriptionItemId,
      itemId: m.prescriptionItemId,
      controlled: m.controlled,
      plannedDose: { dose: m.dose, doseUnit: m.doseUnit, route: m.route },
      drug: `${m.drugName} ${m.strength}`,
      dose: `${m.dose} ${m.doseUnit}`,
      route: m.route,
      scheduledFor: new Date(Math.max(allowed, now)).toISOString(),
      status: allowed - now > DUE_WINDOW_MS ? "scheduled" : "due",
    };
  });
  const charted = entries.filter((e) => e.entryStatus === "ACTIVE").map((e): LiveMarSlot => {
    const medicine = medicines.find((m) => m.prescriptionItemId === e.prescriptionItemId);
    return {
      slotKey: e.id,
      prescriptionId: e.prescriptionItemId,
      itemId: e.prescriptionItemId,
      controlled: medicine?.controlled ?? false,
      drug: medicine ? `${medicine.drugName} ${medicine.strength}` : "Medicine no longer on the chart",
      dose: e.dose !== null ? `${e.dose} ${e.doseUnit}` : medicine ? `${medicine.dose} ${medicine.doseUnit}` : "—",
      route: medicine?.route ?? "—",
      scheduledFor: e.administeredAt,
      status: ENTRY_STATUS[e.status],
      administeredBy: e.administeredByName ? `${e.administeredByName}${e.witnessName ? ` (witness ${e.witnessName})` : ""}` : undefined,
      administeredAt: e.administeredAt,
      reason: e.reason ?? undefined,
    };
  });
  return [...next.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)), ...charted];
}

const VITAL_FIELDS: Record<string, keyof NursingObservation> = { TEMPERATURE: "temp", HEART_RATE: "pulse", RESPIRATORY_RATE: "resp", SPO2: "spo2", PAIN_SCORE: "painScore" };

/** One flowsheet row per round: vital signs and nursing findings recorded at the same moment. */
export function flowsheetRows(admissionId: string, patientId: string, vitals: ApiObservation[], nursing: ApiNursing[]): NursingObservation[] {
  const rows = new Map<string, NursingObservation & { systolic?: number; diastolic?: number }>();
  const row = (at: string, by: string | null) => {
    const existing = rows.get(at);
    if (existing) return existing;
    const created: NursingObservation & { systolic?: number; diastolic?: number } = { id: at, admissionId, patientId, recordedAt: at, recordedBy: by ?? "—" };
    rows.set(at, created);
    return created;
  };
  for (const v of vitals.filter((o) => o.status === "ACTIVE")) {
    const r = row(v.recordedAt, v.recordedByName);
    if (v.code === "BP_SYSTOLIC") r.systolic = v.value;
    else if (v.code === "BP_DIASTOLIC") r.diastolic = v.value;
    else if (VITAL_FIELDS[v.code]) (r as Record<string, unknown>)[VITAL_FIELDS[v.code]] = v.value;
  }
  for (const n of nursing) {
    const r = row(n.recordedAt, n.recordedByName);
    Object.assign(r, {
      ...(n.fluidIntakeMl !== null ? { intakeMl: n.fluidIntakeMl } : {}),
      ...(n.fluidOutputMl !== null ? { outputMl: n.fluidOutputMl } : {}),
      ...(n.mobility ? { mobility: n.mobility } : {}),
      ...(n.fallsRisk ? { fallsRisk: n.fallsRisk } : {}),
      ...(n.pressureRisk ? { pressureRisk: n.pressureRisk } : {}),
      ...(n.note ? { note: n.note } : {}),
    });
  }
  return [...rows.values()]
    .map(({ systolic, diastolic, ...r }) => ({ ...r, ...(systolic && diastolic ? { bp: `${systolic}/${diastolic}` } : {}) }))
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export type ObservationInput = {
  temp?: number; pulse?: number; resp?: number; bp?: string; spo2?: number; painScore?: number;
  intakeMl?: number; outputMl?: number; mobility?: string; fallsRisk?: string; pressureRisk?: string; note?: string;
};
type Staff = { userId: string; name: string };

type LiveWardsState = {
  admissions: LiveAdmission[];
  discharged: LiveAdmission[];
  wards: LiveWard[];
  beds: LiveBed[];
  mar: Record<string, LiveMarSlot[]>;
  flowsheet: Record<string, NursingObservation[]>;
  doctors: Staff[];
  /** colleagues who may witness a controlled dose (may administer medicines) */
  witnesses: Staff[];
  error: string;
  load: () => Promise<void>;
  loadStaff: () => Promise<void>;
  loadFlowsheet: (admission: LiveAdmission) => Promise<void>;
  admit: (input: { patientId: string; bedId: string; diagnosis: string; reason: string; service: string; isolation: string; attendingUserId: string; expectedDischarge: string }) => Promise<void>;
  updateStay: (admission: LiveAdmission, changes: Record<string, unknown>) => Promise<void>;
  transfer: (admission: LiveAdmission, bedId: string, note: string) => Promise<void>;
  discharge: (admission: LiveAdmission, input: { outcome: string; summary: string; destination: string }) => Promise<void>;
  observe: (admission: LiveAdmission, input: ObservationInput) => Promise<void>;
  chart: (admission: LiveAdmission, slot: LiveMarSlot, status: "given" | "held" | "refused" | "omitted", input: { reason?: string; witnessUserId?: string; key: string }) => Promise<void>;
  addWard: (input: { code: string; name: string; kind: string }) => Promise<void>;
  updateWard: (ward: LiveWard, changes: { name: string; kind: string }) => Promise<void>;
  addBed: (wardId: string, code: string) => Promise<void>;
  setBedStatus: (bed: LiveBed, status: "AVAILABLE" | "CLEANING" | "OUT_OF_SERVICE", reason?: string) => Promise<void>;
};

const CHART_STATUS = { given: "GIVEN", held: "HELD", refused: "REFUSED", omitted: "MISSED" } as const;
let contextRevision = 0;
const wardContext = () => {
  const session = useLiveEmr.getState();
  return session.status === 'ready' && session.access ? `${session.access.organizationId}:${session.user?.id}` : '';
};
let context = wardContext();

export const useLiveWards = create<LiveWardsState>((set, get) => {
  const after = async (action: Promise<unknown>) => { await action; await get().load(); };
  return {
    admissions: [],
    discharged: [],
    wards: [],
    beds: [],
    mar: {},
    flowsheet: {},
    doctors: [],
    witnesses: [],
    error: "",

    load: async () => {
      if (!wardContext()) return;
      const revision = contextRevision;
      try {
        const [current, past, wards] = await Promise.all([
          emrRequest<{ data: { items: ApiAdmission[] } }>("/admissions?status=ADMITTED&limit=200"),
          emrRequest<{ data: { items: ApiAdmission[] } }>("/admissions?status=DISCHARGED&limit=100"),
          emrRequest<{ data: { items: ApiWard[] } }>("/wards"),
        ]);
        const bedLists = await Promise.all(wards.data.items.map((ward) => emrRequest<{ data: { beds: ApiBed[] } }>(`/wards/${ward.id}/beds`)));
        const charts = await Promise.all(current.data.items.map((a) => emrRequest<{ data: { medicines: ApiMedicine[]; entries: ApiMarEntry[] } }>(`/admissions/${a.id}/mar`)));
        if (revision !== contextRevision) return;
        set({
          admissions: current.data.items.map(liveAdmission),
          discharged: past.data.items.map(liveAdmission),
          wards: wards.data.items.map((w) => ({ id: w.id, code: w.code, name: w.name, kind: w.kind, type: WARD_KIND_LABEL[w.kind] ?? w.kind, version: w.version })),
          beds: wards.data.items.flatMap((w, i) => bedLists[i].data.beds.map((b) => ({
            id: b.id, wardId: w.id, label: b.code, isVip: false, active: b.status !== "OUT_OF_SERVICE", status: b.status, version: b.version,
          }))),
          mar: Object.fromEntries(current.data.items.map((a, i) => [a.id, marSlots(charts[i].data.medicines, charts[i].data.entries)])),
          error: "",
        });
      } catch (cause) {
        if (revision !== contextRevision) return;
        set({ error: cause instanceof Error ? cause.message : "The wards could not be loaded." });
      }
    },

    loadStaff: async () => {
      if (!wardContext()) return;
      const revision = contextRevision;
      const [doctors, witnesses] = await Promise.all([
        emrRequest<{ data: { items: Staff[] } }>("/staff?permission=diagnosis.record"),
        emrRequest<{ data: { items: Staff[] } }>("/staff?permission=medication.administer"),
      ]);
      if (revision !== contextRevision) return;
      set({ doctors: doctors.data.items, witnesses: witnesses.data.items });
    },

    loadFlowsheet: async (admission) => {
      if (!wardContext()) return;
      const revision = contextRevision;
      const [vitals, nursing] = await Promise.all([
        emrRequest<{ data: { items: ApiObservation[] } }>(`/encounters/${admission.encounterId}/vitals`),
        emrRequest<{ data: { items: ApiNursing[] } }>(`/admissions/${admission.id}/nursing`),
      ]);
      if (revision !== contextRevision) return;
      set((state) => ({ flowsheet: { ...state.flowsheet, [admission.id]: flowsheetRows(admission.id, admission.patientId, vitals.data.items, nursing.data.items) } }));
    },

    // Admission comes from a visit: the patient's open visit, or a new inpatient visit opened for it.
    admit: async (input) => {
      const open = await emrRequest<{ data: { items: Array<{ id: string }> } }>(`/encounters?patientId=${input.patientId}&status=ARRIVED,IN_PROGRESS&limit=1`);
      const encounterId = open.data.items[0]?.id
        ?? (await emrRequest<{ data: { id: string } }>("/encounters", { method: "POST", body: { patientId: input.patientId, class: "INPATIENT", reason: input.diagnosis } })).data.id;
      await after(emrRequest(`/encounters/${encounterId}/admission`, {
        method: "POST",
        idempotencyKey: newIdempotencyKey(),
        body: {
          bedId: input.bedId,
          reason: input.reason.trim() || input.diagnosis.trim(),
          admittingDiagnosis: input.diagnosis.trim(),
          ...(input.service ? { service: input.service } : {}),
          ...(input.isolation.trim() ? { isolation: input.isolation.trim() } : {}),
          ...(input.attendingUserId ? { attendingUserId: input.attendingUserId } : {}),
          ...(input.expectedDischarge ? { expectedDischargeDate: input.expectedDischarge } : {}),
        },
      }));
    },
    updateStay: (admission, changes) => after(emrRequest(`/admissions/${admission.id}`, { method: "PATCH", version: admission.version, body: changes })),
    transfer: (admission, bedId, note) => after(emrRequest(`/admissions/${admission.id}/transfer`, {
      method: "POST", version: admission.version, body: { bedId, ...(note.trim() ? { note: note.trim() } : {}) },
    })),
    discharge: (admission, { outcome, summary, destination }) => after(emrRequest(`/admissions/${admission.id}/discharge`, {
      method: "POST",
      version: admission.version,
      body: { disposition: DISPOSITION_FOR_OUTCOME[outcome] ?? "OTHER", outcome, summary: summary.trim(), ...(destination.trim() ? { destination: destination.trim() } : {}) },
    })),

    // One round: vital signs on the visit and nursing findings on the stay, recorded at the same moment.
    observe: async (admission, input) => {
      const recordedAt = new Date().toISOString();
      const vitals: VitalsForm = { temp: input.temp, pulse: input.pulse, resp: input.resp, spo2: input.spo2, bp: input.bp };
      const readings = [...vitalsReadings(vitals), ...(input.painScore !== undefined ? [{ code: "PAIN_SCORE", value: input.painScore }] : [])];
      const findings = {
        ...(input.intakeMl !== undefined ? { fluidIntakeMl: input.intakeMl } : {}),
        ...(input.outputMl !== undefined ? { fluidOutputMl: input.outputMl } : {}),
        ...(input.mobility ? { mobility: input.mobility } : {}),
        ...(input.fallsRisk ? { fallsRisk: input.fallsRisk } : {}),
        ...(input.pressureRisk ? { pressureRisk: input.pressureRisk } : {}),
        ...(input.note ? { note: input.note } : {}),
      };
      if (!readings.length && !Object.keys(findings).length) throw new Error("Enter at least one observation.");
      if (readings.length) await emrRequest(`/encounters/${admission.encounterId}/vitals`, { method: "POST", body: { recordedAt, readings } });
      if (Object.keys(findings).length) await emrRequest(`/admissions/${admission.id}/nursing`, { method: "POST", body: { recordedAt, ...findings } });
      await Promise.all([get().loadFlowsheet(admission), get().load()]);
    },

    chart: (admission, slot, status, { reason, witnessUserId, key }) => after(emrRequest(`/admissions/${admission.id}/mar`, {
      method: "POST",
      idempotencyKey: key,
      body: {
        prescriptionItemId: slot.itemId,
        status: CHART_STATUS[status],
        ...(status === "given" && slot.plannedDose
          ? { dose: slot.plannedDose.dose, doseUnit: slot.plannedDose.doseUnit, route: slot.plannedDose.route }
          : {}),
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
        ...(witnessUserId ? { witnessUserId } : {}),
      },
    })),

    addWard: ({ code, name, kind }) => after(emrRequest("/wards", { method: "POST", body: { code, name, kind } })),
    updateWard: (ward, { name, kind }) => after(emrRequest(`/wards/${ward.id}`, { method: "PATCH", version: ward.version, body: { name, kind } })),
    addBed: (wardId, code) => after(emrRequest(`/wards/${wardId}/beds`, { method: "POST", body: { codes: [code] } })),
    setBedStatus: (bed, status, reason) => after(emrRequest(`/beds/${bed.id}/status`, {
      method: "POST", version: bed.version, body: { status, ...(reason?.trim() ? { reason: reason.trim() } : {}) },
    })),
  };
});

// Forget clinical data immediately on sign-out or hospital/user switch. An old in-flight
// response must never repopulate the next hospital's ward screen.
useLiveEmr.subscribe(() => {
  const next = wardContext();
  if (next === context) return;
  context = next; contextRevision += 1;
  useLiveWards.setState({ admissions: [], discharged: [], wards: [], beds: [], mar: {}, flowsheet: {}, doctors: [], witnesses: [], error: '' });
});

/** Loads the wards now and keeps them fresh while the In-patient screen is open. */
export function useLiveWardsRefresh(enabled: boolean) {
  const organizationId = useLiveEmr((state) => state.access?.organizationId);
  useEffect(() => {
    if (!enabled) return;
    const { load, loadStaff } = useLiveWards.getState();
    void load();
    loadStaff().catch(() => undefined);
    const timer = window.setInterval(() => { void load(); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [enabled, organizationId]);
}
