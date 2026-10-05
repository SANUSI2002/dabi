import { createScopedStore } from "./scopedStore.js";
import { getCurrentDoctor, getDoctorId, PRIMARY_DOCTOR_ID } from "./doctorSession.js";
const SEED = [
  {
    id: "rev-1",
    patientName: "John Doe",
    rating: 5,
    date: "Oct 24, 2023",
    context: "Re: Cardiology Consultation",
    text: "Dr. Verma was incredibly thorough and took the time to explain my test results in a way I could understand. I didn't feel rushed at all. Highly recommend for anyone needing cardiac care.",
    reply: "Thank you so much for your kind words, John. It was a pleasure reviewing your progress. Don't hesitate to reach out if you have any follow-up questions before your next scheduled visit.",
  },
  {
    id: "rev-2",
    patientName: "Anonymous Patient",
    rating: 4,
    date: "Oct 20, 2023",
    context: "Re: Follow-up Appointment",
    text: "Good experience overall. The consultation started a bit late, but the care provided was excellent and very professional.",
    reply: null,
  },
];

const store = createScopedStore({ key: "sabi-doctor-reviews", seed: () => getDoctorId() === PRIMARY_DOCTOR_ID ? SEED : [], normalize: (rows) => rows.filter((r) => r && typeof r.id === "string" && typeof r.patientName === "string" && typeof r.text === "string" && Number.isFinite(r.rating)) });
const persist = store.write;
const notify = store.notify;
export const subscribeToReviews = store.subscribe;
export const getReviews = store.get;

export function replyToReview(id, reply) {
  const next = getReviews().map((r) => (r.id === id ? { ...r, reply } : r));
  persist(next);
  notify();
  return next.find((r) => r.id === id);
}
