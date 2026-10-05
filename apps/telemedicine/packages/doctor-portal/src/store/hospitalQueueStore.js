import { createScopedStore } from "./scopedStore.js";
import { getCurrentDoctor, getDoctorId } from "./doctorSession.js";
const SEED = [
  { id: "q-1", code: "#C-042", patientName: "Adebayo, Oluwaseun", waitMinutes: 24, reason: "Chest Pain Assessment", plan: "NHIS Family Plan", claimed: false },
  { id: "q-2", code: "#C-045", patientName: "Okafor, Chioma", waitMinutes: 12, reason: "Post-Op Review", plan: "HMO Standard", claimed: false },
  { id: "q-3", code: "#C-048", patientName: "Ibrahim, Fatima", waitMinutes: 5, reason: "ECG Results Interpretation", plan: "Private Pay", claimed: false },
];

const store = createScopedStore({ key: "sabi-hospital-queue", shared: true, scope: () => getCurrentDoctor()?.hospitalId || "none", seed: SEED, normalize: (rows) => rows.filter((r) => r && typeof r.id === "string").map((r) => ({ ...r, assignedDoctorId: r.assignedDoctorId || (r.claimed ? "doctor-verma" : null) })) });
export const getQueue = store.get;
export const subscribeToQueue = store.subscribe;
export function claimPatient(id) {
  store.invalidate();
  const queue = getQueue();
  const row = queue.find((q) => q.id === id);
  if (!row || row.assignedDoctorId) return null;
  const next = store.write(queue.map((q) => q.id === id ? { ...q, claimed: true, assignedDoctorId: getDoctorId(), claimedAt: new Date().toISOString() } : q));
  store.notify();
  return next.find((q) => q.id === id);
}
