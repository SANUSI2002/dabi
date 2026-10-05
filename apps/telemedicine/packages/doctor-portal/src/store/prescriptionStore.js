import { createScopedStore } from "./scopedStore.js";
import { getCurrentDoctor, getDoctorId, PRIMARY_DOCTOR_ID } from "./doctorSession.js";

const store = createScopedStore({ key: "sabi-doctor-prescriptions", seed: () => [], normalize: (rows) => rows.filter((r) => r && typeof r.id === "string" && typeof r.patientName === "string" && (!r.doctorId || r.doctorId === getDoctorId())).map((r) => ({ ...r, doctorId: r.doctorId || getDoctorId(), medications: Array.isArray(r.medications) ? r.medications.filter((m) => m && typeof m.drug === "string").map((m) => ({ dosage: "", frequency: "", quantity: "", duration: "", instructions: "", ...m })) : [], labOrders: Array.isArray(r.labOrders) ? r.labOrders.filter((o) => o && typeof o.test === "string").map((o) => ({ urgency: "Routine", instructions: "", ...o })) : [], status: r.status === "active" ? "draft" : r.status })) });
const persist = store.write;
const notify = store.notify;
export const subscribeToPrescriptions = store.subscribe;
export const getPrescriptions = store.get;

let nextId = 1;
export function addPrescription({ patientName, diagnosisId, diagnosisLabel, medications = [], notes = "", consultationId, labOrders = [], status = "draft", genericSub = true }) {
  if (!patientName?.trim()) throw new Error("Select a patient");
  const rxId = `RX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const rx = {
    id: `rx-${crypto.randomUUID()}`,
    rxId,
    patientName,
    doctorId: getDoctorId(),
    doctorName: getCurrentDoctor().name,
    diagnosisId,
    diagnosisLabel,
    medications,
    notes,
    consultationId,
    labOrders,
    genericSub,
    status,
    patientStatus: "not-sent",
    issuedAt: new Date().toISOString(),
  };
  const next = [rx, ...getPrescriptions()];
  persist(next);
  notify();
  return rx;
}

export function updatePrescription(id, patch) {
  const rows = getPrescriptions();
  const record = rows.find((r) => r.id === id);
  if (!record || record.doctorId !== getDoctorId() || record.status === "sent") return null;
  if (patch.status === "sent" && record.status !== "finalized") return null;
  const { id: ignoredId, doctorId: ignoredDoctor, doctorName: ignoredName, ...safePatch } = patch;
  const next = rows.map((r) => r.id === id ? { ...r, ...safePatch } : r);
  persist(next); notify();
  return next.find((r) => r.id === id);
}

export function sendToPatient(id) {
  const rx = getPrescriptions().find((r) => r.id === id);
  if (!rx || rx.status !== "finalized") return null;
  return updatePrescription(id, { status: "sent", patientStatus: "sent", sentAt: new Date().toISOString(), recipient: rx.patientName, patientTab: "prescriptions" });
}

export function markPrescriptionStatus(id, status) { return updatePrescription(id, { status }); }
