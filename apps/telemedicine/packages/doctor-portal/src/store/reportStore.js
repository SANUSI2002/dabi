import { createScopedStore } from "./scopedStore.js";
import { getCurrentDoctor, getDoctorId, PRIMARY_DOCTOR_ID } from "./doctorSession.js";

const store = createScopedStore({ key: "sabi-doctor-reports", seed: () => [], normalize: (rows) => rows.filter((r) => r && typeof r.id === "string" && typeof r.patientName === "string" && (!r.doctorId || r.doctorId === getDoctorId())).map((r) => ({ ...r, doctorId: r.doctorId || getDoctorId(), labOrders: Array.isArray(r.labOrders) ? r.labOrders.filter((o) => o && typeof o.test === "string").map((o) => ({ urgency: "Routine", instructions: "", ...o })) : [] })) });
const persist = store.write;
const notify = store.notify;
export const subscribeToReports = store.subscribe;
export const getReports = store.get;

let nextId = 1;
export function addReportDraft({ patientName, diagnosisSummary, treatmentPlan, patientMessage, consultationId, subjective = "", objective = "", labOrders = [] }) {
  const report = {
    id: `rpt-${crypto.randomUUID()}`,
    patientName,
    doctorId: getDoctorId(),
    doctorName: getCurrentDoctor().name,
    consultationId,
    subjective,
    objective,
    labOrders,
    consultationDate: new Date().toISOString().slice(0, 10),
    diagnosisSummary,
    treatmentPlan: treatmentPlan || "",
    patientMessage: patientMessage || "",
    status: "draft",
  };
  const next = [report, ...getReports()];
  persist(next);
  notify();
  return report;
}

export function updateReport(id, patch) {
  const rows = getReports();
  const record = rows.find((r) => r.id === id);
  if (!record || record.doctorId !== getDoctorId() || record.status === "sent") return null;
  if (patch.status === "sent" && record.status !== "finalized") return null;
  const { id: ignoredId, doctorId: ignoredDoctor, doctorName: ignoredName, ...safePatch } = patch;
  const next = rows.map((r) => r.id === id ? { ...r, ...safePatch } : r);
  persist(next); notify();
  return next.find((r) => r.id === id);
}

export function sendReport(id, patientMessage) {
  const report = getReports().find((r) => r.id === id);
  if (!report || report.status !== "finalized") return null;
  return updateReport(id, { status: "sent", patientMessage, sentAt: new Date().toISOString(), recipient: report.patientName, patientTab: "prescriptions" });
}
