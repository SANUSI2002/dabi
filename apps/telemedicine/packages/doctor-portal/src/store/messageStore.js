import { createScopedStore } from "./scopedStore.js";
import { getCurrentDoctor, getDoctorId, PRIMARY_DOCTOR_ID } from "./doctorSession.js";
const SEED = [
  {
    id: "th-1",
    patientName: "Sarah Johnson",
    context: "Mother of Timmy",
    tagColor: "green",
    unread: true,
    messages: [
      { from: "patient", text: "Hello Doctor. Timmy has a slight fever this morning (100.2F) and a mild cough. Should we still come in?", at: Date.now() - 1000 * 60 * 90 },
      { from: "doctor", text: "Thanks for letting me know. Given the fever, let's convert to a virtual sick visit instead — does the same time still work?", at: Date.now() - 1000 * 60 * 60 },
      { from: "patient", text: "Yes, that works perfectly. His fever went up a bit more just now.", at: Date.now() - 1000 * 60 * 20, attachment: "throat_pic.jpg" },
    ],
  },
  {
    id: "th-2",
    patientName: "Marcus Reed",
    context: "Re: Lisinopril Prescription",
    tagColor: "blue",
    unread: false,
    messages: [
      { from: "doctor", text: "Your Lisinopril refill is ready for pickup at your pharmacy.", at: Date.now() - 1000 * 60 * 60 * 26 },
      { from: "patient", text: "Thank you, I will pick it up today.", at: Date.now() - 1000 * 60 * 60 * 24 },
    ],
  },
  {
    id: "th-3",
    patientName: "David Chen",
    context: "Re: Lab Results (Lipid Panel)",
    tagColor: "amber",
    unread: true,
    messages: [
      { from: "patient", text: "Could we discuss these lab results over a quick call?", at: Date.now() - 1000 * 60 * 60 * 50 },
    ],
  },
];

const store = createScopedStore({ key: "sabi-doctor-messages", seed: () => getDoctorId() === PRIMARY_DOCTOR_ID ? SEED : [], normalize: (rows) => rows.filter((r) => r && typeof r.id === "string" && typeof r.patientName === "string").map((r) => ({ ...r, messages: Array.isArray(r.messages) ? r.messages.filter((m) => m && typeof m.text === "string") : [] })) });
const persist = store.write;
const notify = store.notify;
export const subscribeToThreads = store.subscribe;
export const getThreads = store.get;

export function markThreadRead(id) {
  const next = getThreads().map((t) => (t.id === id ? { ...t, unread: false } : t));
  persist(next);
  notify();
  return next;
}

export function sendMessage(threadId, text) {
  const next = getThreads().map((t) =>
    t.id === threadId ? { ...t, messages: [...t.messages, { from: "doctor", text, at: Date.now() }] } : t
  );
  persist(next);
  notify();
  return next.find((t) => t.id === threadId);
}
