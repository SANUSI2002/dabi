import { createScopedStore } from "./scopedStore.js";
import { getCurrentDoctor, getDoctorId, PRIMARY_DOCTOR_ID, DEMO_DOCTORS } from "./doctorSession.js";
const SEED = [
  {
    id: "dx-1",
    patientName: "Eleanor Vance",
    label: "Stage 1 Essential Hypertension",
    icd10: "I10",
    notes: "Blood pressure elevated on two consecutive readings. Recommending lifestyle changes plus low-dose medication.",
    doctorName: DEMO_DOCTORS[0].name,
    authorDoctorId: PRIMARY_DOCTOR_ID,
    authoredByCurrentDoctor: true,
    consultationId: "apt-3",
    date: new Date().toISOString().slice(0, 10),
  },
  {
    id: "dx-2",
    patientName: "Michael Chen",
    label: "Mild Intermittent Asthma",
    icd10: "J45.20",
    notes: "Diagnosed during a prior pediatric consult. Managed with rescue inhaler as needed.",
    doctorName: "Dr. Ike Chukwu",
    authorDoctorId: "doctor-chukwu",
    authoredByCurrentDoctor: false,
    consultationId: null,
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString().slice(0, 10),
  },
  {
    id: "dx-3",
    patientName: "Funmi Okafor",
    label: "Seasonal Allergic Rhinitis",
    icd10: "J30.2",
    notes: "Routine check-in confirmed seasonal pattern. Antihistamine course recommended.",
    doctorName: DEMO_DOCTORS[0].name,
    authorDoctorId: PRIMARY_DOCTOR_ID,
    authoredByCurrentDoctor: true,
    consultationId: "apt-10",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString().slice(0, 10),
  },
];

const store = createScopedStore({ key: "sabi-doctor-diagnoses", seed: () => getDoctorId() === PRIMARY_DOCTOR_ID ? SEED : [], normalize: (rows) => rows.filter((r) => r && typeof r.id === "string" && typeof r.patientName === "string" && (!r.doctorId || r.doctorId === getDoctorId())).map((r) => ({ ...r, doctorId: r.doctorId || getDoctorId(), authoredByCurrentDoctor: r.authorDoctorId ? r.authorDoctorId === getDoctorId() : !!r.authoredByCurrentDoctor })) });
const persist = store.write;
const notify = store.notify;
export const subscribeToDiagnoses = store.subscribe;
export const getDiagnoses = store.get;

export function getDiagnosesForPatient(patientName) {
  return getDiagnoses().filter((d) => d.patientName === patientName);
}

let nextId = 1;
// Accepts separate assessment and diagnosis fields.
// NOTE: backend API needs an `assessment` column and a `diagnosis` column on
// the consultation / note table to persist these server-side independently.
export function addDiagnosis({ patientName, label, assessment, diagnosis, icd10, notes, consultationId }) {
  const resolvedLabel = label || diagnosis || assessment || "";
  const dx = {
    id: `dx-${Date.now()}-${nextId++}`,
    patientName,
    label: resolvedLabel,
    assessment: assessment || "",
    diagnosis: diagnosis || "",
    icd10: icd10 || "",
    notes: notes || "",
    doctorName: getCurrentDoctor().name,
    doctorId: getDoctorId(),
    authorDoctorId: getDoctorId(),
    authoredByCurrentDoctor: true,
    consultationId: consultationId || null,
    date: new Date().toISOString().slice(0, 10),
  };
  const next = [dx, ...getDiagnoses()];
  persist(next);
  notify();
  return dx;
}
