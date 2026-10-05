import { createScopedStore } from "./scopedStore.js";
import { getCurrentDoctor, getDoctorId, PRIMARY_DOCTOR_ID } from "./doctorSession.js";
const SEED = [
  { id: "act-seed-1", text: "Tunde Bello checked in for Hospital Visit.", at: Date.now() - 1000 * 60 * 10 },
  { id: "act-seed-2", text: "New message from Funmi Okafor.", at: Date.now() - 1000 * 60 * 60 },
  { id: "act-seed-3", text: "Chidi Musa left a 5-star review.", at: Date.now() - 1000 * 60 * 60 * 22 },
];


const store = createScopedStore({ key: "sabi-doctor-activity", seed: () => getDoctorId() === PRIMARY_DOCTOR_ID ? SEED : [], normalize: (rows) => rows.filter((r) => r && typeof r.id === "string" && typeof r.text === "string" && Number.isFinite(r.at)) });
const persist = store.write;
const notify = store.notify;
export const subscribeToActivity = store.subscribe;
export const getActivity = store.get;

let nextId = 1;
export function addActivity(text) {
  const entry = { id: `act-${Date.now()}-${nextId++}`, text, at: Date.now() };
  const next = [entry, ...getActivity()].slice(0, 30);
  persist(next);
  notify();
  return entry;
}

export function timeAgo(ts) {
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.round(diffHr / 24);
  return diffDay === 1 ? "Yesterday" : `${diffDay} days ago`;
}
