import { useEffect, useMemo, useRef, useState } from "react";
import type { Prescription, Vitals } from "@/data/types";
import type { PhysicalExaminationSystem } from "@/data/wardRound";
import type { VitalReading } from "@/components/clinical/VitalTrend";
import { emrRequest, newIdempotencyKey } from "./client";
import { useLiveQueue, useLiveQueueRefresh } from "./queue";
import { liveCan, useLiveEmr } from "./session";
import type { LiveQueueEntry } from "./mappers";

// The consultation room for a live hospital: the visit's vitals and draft note are loaded from the
// backend, and signing records the note, diagnoses, prescriptions and lab orders on the visit, then
// routes the patient on. Each step is remembered once done, so retrying after a failure (a safety
// check, a lost connection) never records anything twice.

type ApiEncounter = { id: string; status: "ARRIVED" | "IN_PROGRESS" | "FINISHED" | "CANCELLED"; version: number; visitType: string | null; nhmisIndicators: string[] };
type ApiNote = {
  id: string; kind: string; status: "DRAFT" | "SIGNED"; authorUserId: string; version: number;
  subjective: string | null; objective: string | null; assessment: string | null; plan: string | null;
  examination: PhysicalExaminationSystem[] | null; followUp: string | null; patientInstructions: string | null;
};
type ApiObservation = { code: string; value: number; recordedAt: string; recordedByName: string | null; status: "ACTIVE" | "ENTERED_IN_ERROR" };
type ApiLabTest = { code: string; name: string; section: string };
type ApiWard = { id: string; name: string; code: string; beds: { AVAILABLE: number } };
type ApiBed = { id: string; code: string; status: string };
type ApiAllergy = { substance: string; reaction: string | null; severity: string };

/**
 * What the consultation header says about allergies: confirmed (coded) allergies first, then what
 * the patient reported at registration. Empty means nothing is recorded — never "no known allergies".
 */
export function allergySummary(confirmed: ApiAllergy[], reported: string | null | undefined) {
  const coded = confirmed.map((allergy) => `${allergy.substance}${allergy.reaction ? ` (${allergy.reaction})` : ""}`);
  const desk = reported?.trim();
  return [...coded, ...(desk ? [`reported at registration: ${desk}`] : [])].join("; ");
}

/** The draft consultation note (if any) saved earlier on this visit, to reopen in the form. */
export type LiveDraft = {
  subjective: string; objective: string; assessment: string; plan: string;
  examination: PhysicalExaminationSystem[]; followUp: string; patientInstructions: string;
  visitType: string | null; nhmisIndicators: string[];
};

export type ConsultationInput = {
  soap: { s: string; o: string; a: string; p: string };
  examination: PhysicalExaminationSystem[];
  followUp: string;
  instructions: string;
  visitType: string;
  nhmisIndicators: string[];
  diagnoses: { code: string; name: string; toProblemList: boolean }[];
  prescriptions: Prescription[];
  labCodes: string[];
  routeStation: string;
};

// ---- vitals ----

const VITAL_FIELDS: Record<string, keyof Vitals> = {
  TEMPERATURE: "temp", HEART_RATE: "pulse", RESPIRATORY_RATE: "resp", SPO2: "spo2", WEIGHT: "weight",
  HEIGHT: "height", BLOOD_GLUCOSE: "glucose", PAIN_SCORE: "painScore", MUAC: "muac",
};

/** Readings taken together (same time) as one vitals set, oldest first. */
export function vitalsSets(observations: ApiObservation[]): Vitals[] {
  const sets = new Map<string, Vitals & { systolic?: number; diastolic?: number }>();
  for (const reading of observations.filter((o) => o.status === "ACTIVE")) {
    const set = sets.get(reading.recordedAt) ?? { takenAt: reading.recordedAt, takenBy: reading.recordedByName ?? "Unknown staff member" };
    if (reading.code === "BP_SYSTOLIC") set.systolic = reading.value;
    else if (reading.code === "BP_DIASTOLIC") set.diastolic = reading.value;
    else if (VITAL_FIELDS[reading.code]) (set as Record<string, unknown>)[VITAL_FIELDS[reading.code]] = reading.value;
    sets.set(reading.recordedAt, set);
  }
  return [...sets.values()]
    .map(({ systolic, diastolic, ...set }) => ({ ...set, ...(systolic && diastolic ? { bp: `${systolic}/${diastolic}` } : {}) }))
    .sort((left, right) => left.takenAt.localeCompare(right.takenAt));
}

// ---- prescriptions ----

const FREQUENCIES = ["OD", "MANE", "NOCTE", "BD", "TDS", "QDS", "Q4H", "Q6H", "Q8H", "Q12H", "WEEKLY", "STAT", "PRN"];
const LINE_FIELDS: Record<string, string> = { durationDays: "duration", quantity: "quantity", doseUnit: "dose unit", prnReason: "as-needed reason", dose: "dose", frequency: "frequency" };

/** One prescription row as the API's line. Throws a sentence the prescriber can act on. */
export function prescriptionLine(row: Prescription) {
  const drug = row.drug.trim() || "A medicine";
  if (!row.drugCode || !row.doseUnit) throw new Error(`${drug}: choose it from the formulary list so the pharmacy knows exactly which product.`);
  const dose = /^(\d+(?:\.\d+)?)\s*([^\d\s].*)?$/.exec(row.dose.trim());
  if (!dose) throw new Error(`${drug}: write the dose as a number, e.g. 500 ${row.doseUnit}.`);
  const unit = dose[2]?.trim();
  if (unit && unit.toLowerCase() !== row.doseUnit.toLowerCase()) throw new Error(`${drug}: the dose must be in ${row.doseUnit}.`);
  // "PRN pain" = as needed, with the reason the drug may be given.
  const [frequencyCode, ...reason] = row.frequency.trim().split(/\s+/);
  const frequency = frequencyCode?.toUpperCase();
  if (!frequency || !FREQUENCIES.includes(frequency)) throw new Error(`${drug}: frequency must be one of ${FREQUENCIES.join(", ")} (e.g. "PRN pain" for as needed).`);
  const duration = /^(\d+)\s*(d|day|days|w|wk|wks|week|weeks)?$/i.exec(row.duration.trim());
  if (row.duration.trim() && !duration) throw new Error(`${drug}: write the duration in days or weeks, e.g. 5 days.`);
  const durationDays = duration ? Number(duration[1]) * (/^w/i.test(duration[2] ?? "") ? 7 : 1) : undefined;
  return {
    drugCode: row.drugCode,
    dose: Number(dose[1]),
    doseUnit: row.doseUnit,
    frequency,
    ...(durationDays ? { durationDays } : {}),
    ...(row.qty > 0 ? { quantity: row.qty } : {}),
    ...(frequency === "PRN" && reason.length ? { prnReason: reason.join(" ") } : {}),
  };
}

/** Prescribing problems from the API (per-line fields and safety alerts) as readable sentences. */
function prescribingError(cause: unknown, rows: Prescription[]): Error {
  const error = cause as { code?: string; message?: string; details?: Array<{ field?: string; message: string; drugCode?: string }> };
  if (!error.details?.length) return cause instanceof Error ? cause : new Error("The prescription could not be recorded.");
  const nameOf = (code?: string) => rows.find((row) => row.drugCode === code)?.drug ?? code ?? "A medicine";
  const lines = error.details.map((detail) => {
    if (detail.drugCode) return `${nameOf(detail.drugCode)}: ${detail.message}`;
    const [code, field] = (detail.field ?? "").split(".");
    return `${nameOf(code)}: ${LINE_FIELDS[field] ?? field} ${detail.message}`;
  });
  const lead = error.code === "SAFETY_CHECK_REQUIRED" ? "Safety check — change the prescription: " : "";
  return new Error(lead + lines.join(" · "));
}

// ---- the live consultation room ----

type Saved = { encounterId: string; noteSigned: boolean; diagnoses: Set<number>; prescribed: boolean; labsOrdered: boolean; keys: { rx: string; lab: string } };
const freshSaved = (encounterId: string): Saved => ({
  encounterId, noteSigned: false, diagnoses: new Set(), prescribed: false, labsOrdered: false, keys: { rx: newIdempotencyKey(), lab: newIdempotencyKey() },
});

export function useLiveConsultation(activeQueueId: string | null, enabled: boolean, onDraftLoaded: (draft: LiveDraft) => void) {
  useLiveQueueRefresh(enabled);
  const entries = useLiveQueue((state) => state.entries);
  const reloadQueue = useLiveQueue((state) => state.load);
  const updateQueue = useLiveQueue((state) => state.update);
  const userName = useLiveEmr((state) => state.user?.name ?? "");

  const queue = useMemo(
    () => entries.filter((entry) => entry.station === "Consultation" && (entry.status === "Waiting" || entry.status === "In Progress")),
    [entries],
  );
  const entry = entries.find((item) => item.id === activeQueueId);
  const encounterId = entry?.encounterId;
  const patientId = entry?.patientId;

  const [visit, setVisit] = useState<{ encounterId: string; vitals: Vitals[] } | null>(null);
  const [allergyState, setAllergyState] = useState<{ patientId: string; text: string } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [labTests, setLabTests] = useState<ApiLabTest[]>([]);
  const [wards, setWards] = useState<ApiWard[]>([]);
  const encounterRef = useRef<ApiEncounter | null>(null);
  const noteRef = useRef<ApiNote | null>(null);
  const saved = useRef<Saved | null>(null);
  const draftListener = useRef(onDraftLoaded);
  useEffect(() => { draftListener.current = onDraftLoaded; });
  // Values for the visit/patient on screen only — never a previous patient's while the next loads.
  const vitals = visit && visit.encounterId === encounterId ? visit.vitals : [];
  const allergies = allergyState && allergyState.patientId === entry?.patientId ? allergyState.text : null;

  // The chosen visit: its current state, the caller's draft consultation note, and its vitals.
  useEffect(() => {
    if (!enabled || !encounterId) return;
    let active = true;
    encounterRef.current = null;
    noteRef.current = null;
    const userId = useLiveEmr.getState().user?.id;
    Promise.all([
      emrRequest<{ data: ApiEncounter }>(`/encounters/${encounterId}`),
      emrRequest<{ data: { items: ApiNote[] } }>(`/encounters/${encounterId}/notes`),
      emrRequest<{ data: { items: ApiObservation[] } }>(`/encounters/${encounterId}/vitals`),
    ])
      .then(([encounter, notes, observations]) => {
        if (!active) return;
        encounterRef.current = encounter.data;
        // Only the author may continue a draft, so reopen the signed-in clinician's own.
        const note = notes.data.items.find((item) => item.kind === "CONSULTATION" && item.status === "DRAFT" && item.authorUserId === userId) ?? null;
        noteRef.current = note;
        if (note || encounter.data.visitType || encounter.data.nhmisIndicators.length) {
          draftListener.current({
            subjective: note?.subjective ?? "", objective: note?.objective ?? "", assessment: note?.assessment ?? "", plan: note?.plan ?? "",
            examination: note?.examination ?? [], followUp: note?.followUp ?? "", patientInstructions: note?.patientInstructions ?? "",
            visitType: encounter.data.visitType, nhmisIndicators: encounter.data.nhmisIndicators,
          });
        }
        setVisit({ encounterId, vitals: vitalsSets(observations.data.items) });
        setLoadError("");
      })
      .catch((cause) => { if (active) setLoadError(cause instanceof Error ? cause.message : "This visit could not be loaded."); });
    return () => { active = false; };
  }, [enabled, encounterId]);

  // The patient's allergies (null while loading or when the role may not read them).
  useEffect(() => {
    if (!enabled || !patientId) return;
    let active = true;
    Promise.all([
      emrRequest<{ data: { reportedAllergies?: string | null } }>(`/patients/${patientId}`),
      emrRequest<{ data: { items: ApiAllergy[] } }>(`/patients/${patientId}/allergies`),
    ])
      .then(([patient, recorded]) => { if (active) setAllergyState({ patientId, text: allergySummary(recorded.data.items, patient.data.reportedAllergies) }); })
      .catch(() => { if (active) setAllergyState(null); });
    return () => { active = false; };
  }, [enabled, patientId]);

  // The hospital's lab catalog and wards (for ordering and admitting), if the role may use them.
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    if (liveCan("lab.order.create")) {
      emrRequest<{ data: { items: ApiLabTest[] } }>("/lab/tests").then((result) => { if (active) setLabTests(result.data.items); }).catch(() => undefined);
    }
    if (liveCan("admission.read")) {
      emrRequest<{ data: { items: ApiWard[] } }>("/wards").then((result) => { if (active) setWards(result.data.items); }).catch(() => undefined);
    }
    return () => { active = false; };
  }, [enabled]);

  const labPanels = useMemo(() => {
    const panels: Record<string, { key: string; label: string }[]> = {};
    for (const test of labTests) (panels[test.section] ??= []).push({ key: test.code, label: test.name });
    return panels;
  }, [labTests]);

  async function currentEncounter() {
    if (!encounterId) throw new Error("Choose a patient from the consultation queue.");
    if (!encounterRef.current) encounterRef.current = (await emrRequest<{ data: ApiEncounter }>(`/encounters/${encounterId}`)).data;
    return encounterRef.current;
  }

  /** The visit is in progress from the moment the clinician writes on it. */
  async function ensureStarted() {
    const encounter = await currentEncounter();
    if (encounter.status === "ARRIVED") {
      encounterRef.current = (await emrRequest<{ data: ApiEncounter }>(`/encounters/${encounter.id}/start`, { method: "POST", body: {}, version: encounter.version })).data;
    }
    return encounterRef.current!;
  }

  async function saveVisitDetails(input: ConsultationInput) {
    const encounter = encounterRef.current!;
    const same = encounter.visitType === (input.visitType.trim() || null)
      && encounter.nhmisIndicators.join("|") === input.nhmisIndicators.join("|");
    if (same) return;
    encounterRef.current = (await emrRequest<{ data: ApiEncounter }>(`/encounters/${encounter.id}`, {
      method: "PATCH", version: encounter.version, body: { visitType: input.visitType.trim() || null, nhmisIndicators: input.nhmisIndicators },
    })).data;
  }

  async function saveNote(input: ConsultationInput) {
    const text = (value: string) => value.trim() || null;
    const content = {
      subjective: text(input.soap.s), objective: text(input.soap.o), assessment: text(input.soap.a), plan: text(input.soap.p),
      examination: input.examination.filter((system) => system.status !== "Not Examined"),
      followUp: text(input.followUp), patientInstructions: text(input.instructions),
    };
    const encounter = encounterRef.current!;
    const note = noteRef.current;
    noteRef.current = note
      ? (await emrRequest<{ data: ApiNote }>(`/encounters/${encounter.id}/notes/${note.id}`, { method: "PATCH", version: note.version, body: content })).data
      : (await emrRequest<{ data: ApiNote }>(`/encounters/${encounter.id}/notes`, { method: "POST", body: { kind: "CONSULTATION", ...content } })).data;
    return noteRef.current;
  }

  /** Saves the note as an unsigned draft; the patient stays in progress with this clinician. */
  async function saveDraft(input: ConsultationInput) {
    await ensureStarted();
    await saveVisitDetails(input);
    await saveNote(input);
    if (entry && entry.status !== "In Progress") await updateQueue(entry, { status: "In Progress" });
  }

  /** Signs the note, records diagnoses and orders, then routes the patient. Returns what was recorded. */
  async function sign(input: ConsultationInput) {
    if (!entry || !encounterId) throw new Error("Choose a patient from the consultation queue.");
    if (saved.current?.encounterId !== encounterId) saved.current = freshSaved(encounterId);
    const done = () => saved.current!;
    const encounter = await ensureStarted();
    const recorded: string[] = [];

    if (!done().noteSigned) {
      await saveVisitDetails(input);
      const note = await saveNote(input);
      await emrRequest(`/encounters/${encounter.id}/notes/${note.id}/sign`, { method: "POST", body: {}, version: note.version });
      done().noteSigned = true;
      noteRef.current = null;
    }

    for (const [index, diagnosis] of input.diagnoses.entries()) {
      if (done().diagnoses.has(index)) continue;
      await emrRequest(`/encounters/${encounter.id}/diagnoses`, {
        method: "POST",
        body: { codeSystem: "ICD11", code: diagnosis.code, description: diagnosis.name, rank: index === 0 ? "PRIMARY" : "SECONDARY", onProblemList: diagnosis.toProblemList },
      });
      done().diagnoses.add(index);
    }
    if (input.diagnoses.length) recorded.push(`${input.diagnoses.length} diagnosis${input.diagnoses.length === 1 ? "" : "es"}`);

    const rows = input.prescriptions.filter((row) => row.drug.trim());
    if (rows.length && !done().prescribed) {
      const items = rows.map(prescriptionLine);
      try {
        await emrRequest(`/encounters/${encounter.id}/prescriptions`, { method: "POST", body: { items }, idempotencyKey: done().keys.rx });
      } catch (cause) {
        // A refused prescription was not recorded: the corrected one may reuse nothing.
        done().keys.rx = newIdempotencyKey();
        throw prescribingError(cause, rows);
      }
      done().prescribed = true;
    }
    if (rows.length) recorded.push(`prescription sent to pharmacy`);

    if (input.labCodes.length && !done().labsOrdered) {
      await emrRequest(`/encounters/${encounter.id}/lab-orders`, { method: "POST", body: { tests: input.labCodes }, idempotencyKey: done().keys.lab });
      done().labsOrdered = true;
    }
    if (input.labCodes.length) recorded.push(`${input.labCodes.length} lab test${input.labCodes.length === 1 ? "" : "s"} ordered`);

    // Route on: leaving the hospital closes the visit; any other station queues the patient there.
    if (input.routeStation === "Exit") {
      const current = await emrRequest<{ data: ApiEncounter }>(`/encounters/${encounter.id}`);
      await emrRequest(`/encounters/${encounter.id}/finish`, { method: "POST", body: {}, version: current.data.version });
      await reloadQueue();
    } else {
      await updateQueue(entry as LiveQueueEntry, { station: input.routeStation as LiveQueueEntry["station"], status: "Waiting" });
    }
    saved.current = null;
    return recorded;
  }

  async function admit(bedId: string, reason: string) {
    if (!encounterId) throw new Error("Choose a patient from the consultation queue.");
    await emrRequest(`/encounters/${encounterId}/admission`, { method: "POST", body: { bedId, reason: reason.trim().slice(0, 500) || "For observation" }, idempotencyKey: newIdempotencyKey() });
    await reloadQueue();
  }

  return {
    queue, entry, vitals, allergies, loadError, labPanels, wards, userName,
    saveDraft, sign, admit,
    vitalReadings: vitals.map((set): VitalReading => ({
      at: set.takenAt, by: set.takenBy, bp: set.bp, temp: set.temp, pulse: set.pulse, resp: set.resp, spo2: set.spo2, glucose: set.glucose, painScore: set.painScore,
    })),
  };
}

/** Free beds in a ward, for the admission dialog. */
export function useLiveWardBeds(wardId: string, enabled: boolean) {
  const [state, setState] = useState<{ wardId: string; beds: ApiBed[] } | null>(null);
  useEffect(() => {
    if (!enabled || !wardId) return;
    let active = true;
    emrRequest<{ data: { beds: ApiBed[] } }>(`/wards/${wardId}/beds`)
      .then((result) => { if (active) setState({ wardId, beds: result.data.beds.filter((bed) => bed.status === "AVAILABLE") }); })
      .catch(() => { if (active) setState({ wardId, beds: [] }); });
    return () => { active = false; };
  }, [enabled, wardId]);
  return state && state.wardId === wardId ? state.beds : [];
}

// ---- formulary lookup for the prescription rows ----

export type FormularyProduct = { code: string; genericName: string; strength: string; doseUnit: string; inStock: number };

/** Active formulary products matching what the prescriber has typed. */
export function useLiveFormulary(query: string, enabled: boolean) {
  const [products, setProducts] = useState<FormularyProduct[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const q = query.trim().slice(0, 60);
    const timer = window.setTimeout(() => {
      emrRequest<{ data: { items: FormularyProduct[] } }>(`/pharmacy/formulary${q ? `?q=${encodeURIComponent(q)}` : ""}`)
        .then((result) => { if (active) setProducts(result.data.items.slice(0, 6)); })
        .catch(() => { if (active) setProducts([]); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, enabled]);
  return enabled ? products : [];
}
