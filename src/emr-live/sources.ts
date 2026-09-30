import { useMemo, useRef } from "react";
import { useEmr } from "@/store/useEmr";
import type { Patient, QueueEntry, Station } from "@/data/types";
import type { DuplicateCandidate, DuplicateMatch } from "@/lib/duplicates";
import { newIdempotencyKey } from "./client";
import type { LiveQueueEntry, RegistrationForm } from "./mappers";
import { useLiveQueue, useLiveQueueRefresh } from "./queue";
import { registerLivePatient, useLiveDuplicateMatches, useLiveDuplicatePairs, useLivePatientSearch, useLivePatients, type DuplicatePair } from "./registry";
import { useIsLiveEmr } from "./session";
import { recordLiveVitals, recordLiveVitalsNote, vitalsReadings, type VitalsForm } from "./vitals";

// One data source per screen. In the demo the screens keep working on the local demo store exactly
// as before; for a real hospital sign-in the same screens read and write the live EMR backend.
// The screens render the same markup either way — only where the data comes from changes.

// ---- Registration ----

export type RegistrySource = {
  list: Patient[];
  onFile: number;
  /** Set when the registry holds more matching patients than are listed ("search to narrow"). */
  moreThanShown: number;
  error: string;
  matches: DuplicateMatch[];
  pairs: DuplicatePair[];
  register: (form: RegistrationForm) => Promise<void>;
  addToQueue: (patientId: string) => Promise<void>;
};

export function useRegistrySource(query: string, candidate: DuplicateCandidate | null, refreshKey: number): RegistrySource {
  const live = useIsLiveEmr();
  const { patients, registerPatient, addToQueue, duplicateRisk, likelyDuplicatePairs } = useEmr();
  const livePatients = useLivePatients(query, live, refreshKey);
  const liveMatches = useLiveDuplicateMatches(candidate, live);
  const livePairs = useLiveDuplicatePairs(live, refreshKey);
  const registrationKey = useRef<string | null>(null);
  const checkIn = useLiveQueue((state) => state.checkIn);

  const firstName = candidate?.firstName ?? "";
  const lastName = candidate?.lastName ?? "";
  const dob = candidate?.dob;
  const phone = candidate?.phone;
  const nin = candidate?.nin;
  const demoMatches = useMemo(
    () => (!live && firstName && lastName ? duplicateRisk({ firstName, lastName, dob, phone, nin }) : []),
    [live, firstName, lastName, dob, phone, nin, duplicateRisk],
  );

  if (live) {
    return {
      list: livePatients.patients,
      onFile: livePatients.onFile,
      moreThanShown: livePatients.matching > livePatients.patients.length ? livePatients.matching : 0,
      error: livePatients.error,
      matches: liveMatches,
      pairs: livePairs,
      register: async (form) => {
        registrationKey.current ??= newIdempotencyKey();
        await registerLivePatient(form, registrationKey.current);
        registrationKey.current = null;
      },
      addToQueue: (patientId) => checkIn(patientId, "Vital", "Normal"),
    };
  }

  const needle = query.toLowerCase();
  return {
    list: patients.filter((patient) =>
      `${patient.firstName} ${patient.lastName} ${patient.otherName ?? ""} ${patient.mrn} ${patient.phone ?? ""} ${patient.nin ?? ""}`
        .toLowerCase()
        .includes(needle),
    ),
    onFile: patients.length,
    moreThanShown: 0,
    error: "",
    matches: demoMatches,
    pairs: likelyDuplicatePairs(),
    register: async (form) => { registerPatient(form as unknown as Omit<Patient, "id" | "mrn" | "registeredAt">); },
    addToQueue: async (patientId) => { addToQueue(patientId, "Vital", "Normal"); },
  };
}

// ---- Clinical queue ----

export type QueueSource = {
  queue: QueueEntry[];
  error: string;
  patientOf: (entry: QueueEntry) => Patient | undefined;
  callNext: (station?: Station) => Promise<{ entry: QueueEntry; patient?: Patient } | null>;
  start: (entry: QueueEntry) => Promise<void>;
  addToQueue: (patientId: string, station: Station, priority: QueueEntry["priority"], complaint: string) => Promise<void>;
};

export function useQueueSource(): QueueSource {
  const live = useIsLiveEmr();
  const { queue, patientById, addToQueue, advanceQueue, callNext } = useEmr();
  const liveQueue = useLiveQueue();
  useLiveQueueRefresh(live);

  if (live) {
    return {
      queue: liveQueue.entries,
      error: liveQueue.error,
      patientOf: (entry) => (entry as LiveQueueEntry).patient,
      callNext: async (station) => {
        const next = await liveQueue.callNext(station);
        return next ? { entry: next, patient: next.patient } : null;
      },
      start: (entry) => liveQueue.update(entry as LiveQueueEntry, { status: "In Progress" }),
      addToQueue: (patientId, station, priority, complaint) => liveQueue.checkIn(patientId, station, priority, complaint),
    };
  }

  return {
    queue,
    error: "",
    patientOf: (entry) => patientById(entry.patientId),
    callNext: async (station) => {
      const next = callNext(station);
      return next ? { entry: next, patient: patientById(next.patientId) } : null;
    },
    start: async (entry) => { advanceQueue(entry.id, "In Progress"); },
    addToQueue: async (patientId, station, priority, complaint) => { addToQueue(patientId, station, priority, complaint); },
  };
}

// ---- Vitals & routing ----

export type VitalsSource = {
  patient?: Patient;
  entry?: QueueEntry;
  /** Records the vitals and, for a queued patient, routes them on. Safe to retry after a failure. */
  save: (form: VitalsForm, route: Station, priority: QueueEntry["priority"]) => Promise<void>;
};

export function useVitalsSource(patientId: string, queueId: string | undefined): VitalsSource {
  const live = useIsLiveEmr();
  const { patientById, recordVitals, advanceQueue, setQueuePriority } = useEmr();
  const demoEntry = useEmr((state) => state.queue.find((entry) => entry.id === queueId));
  const liveEntry = useLiveQueue((state) => state.entries.find((entry) => entry.id === queueId));
  const updateLive = useLiveQueue((state) => state.update);
  // Steps already saved for this visit, so retrying after a failed routing never records vitals twice.
  const saved = useRef<{ encounterId?: string; vitals: boolean; note: boolean }>({ vitals: false, note: false });

  if (live) {
    return {
      patient: liveEntry?.patient,
      entry: liveEntry,
      save: async (form, route, priority) => {
        if (!liveEntry?.encounterId) throw new Error("This patient is no longer in the queue.");
        if (saved.current.encounterId !== liveEntry.encounterId) saved.current = { encounterId: liveEntry.encounterId, vitals: false, note: false };
        if (!saved.current.vitals) {
          await recordLiveVitals(liveEntry.encounterId, vitalsReadings(form));
          saved.current.vitals = true;
        }
        if (form.notes && !saved.current.note) {
          await recordLiveVitalsNote(liveEntry.encounterId, form.notes);
          saved.current.note = true;
        }
        await updateLive(liveEntry, { station: route, priority, status: "Waiting" });
        saved.current = { vitals: false, note: false };
      },
    };
  }

  return {
    patient: patientById(patientId),
    entry: demoEntry,
    save: async (form, route, priority) => {
      recordVitals(patientId, form);
      if (queueId) {
        setQueuePriority(queueId, priority);
        advanceQueue(queueId, "Waiting", route);
      }
    },
  };
}

// ---- Patient lookup (pickers, top search bar) ----

export function usePatientLookup(query: string, limit: number, filter?: (patient: Patient) => boolean): Patient[] {
  const live = useIsLiveEmr();
  const patients = useEmr((state) => state.patients);
  const liveResults = useLivePatientSearch(query, live, limit);
  const needle = query.toLowerCase();
  const source = live
    ? liveResults
    : patients.filter((patient) => `${patient.firstName} ${patient.lastName} ${patient.mrn} ${patient.phone ?? ""}`.toLowerCase().includes(needle));
  return source.filter((patient) => (filter ? filter(patient) : true)).slice(0, limit);
}

/** A patient already chosen by id: from the demo store, or — live — only the record the screen picked. */
export function useChosenPatient(id: string | null | undefined, picked: Patient | null): Patient | undefined {
  const live = useIsLiveEmr();
  const demoPatient = useEmr((state) => (id ? state.patients.find((patient) => patient.id === id) : undefined));
  if (picked && picked.id === id) return picked;
  return live ? undefined : demoPatient;
}
