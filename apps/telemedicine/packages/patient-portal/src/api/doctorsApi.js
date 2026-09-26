// Doctor directory (/doctor-care/doctors) and doctor bookings (/doctor-appointments).
// Doctors publish availability slots; a patient books a slot and the doctor confirms or declines.
// Nothing here is confirmed until the doctor acts, so the UI always shows the server's status.
import { authorizedRequest } from "../utils/sabiIdentity";

const data = async (promise) => (await promise).data;
const get = (path, query) => data(authorizedRequest(path, { query }));
const post = (path, body = {}) => data(authorizedRequest(path, { method: "POST", body }));

export const CONSULTATION_LABELS = { VIRTUAL: "Video consultation", IN_PERSON: "In-person visit" };

export const initialsOf = (name = "") =>
  name
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "DR";

export const formatNaira = (amount) => `₦${Number(amount).toLocaleString("en-NG")}`;

export const toDoctor = (d) => ({
  id: d.id,
  name: d.user?.full_name || "Doctor",
  initials: initialsOf(d.user?.full_name),
  specialty: d.specialty || "General Practice",
  practiceName: d.practiceName || null,
  practiceAddress: d.practiceAddress || null,
  bio: d.bio || null,
  yearsOfExperience: d.yearsOfExperience ?? null,
  fee: d.consultationFeeMinor != null ? d.consultationFeeMinor / 100 : null,
  consultationTypes: d.consultationTypes || [],
  nextAvailableAt: d.nextAvailableAt || null,
});

/** Verified doctors only (the server never lists unverified ones). */
export async function listDoctors({ search, specialty } = {}) {
  const result = await get("/api/v1/doctor-care/doctors", {
    limit: 100,
    ...(search && search.trim().length >= 2 ? { search: search.trim() } : {}),
    ...(specialty ? { specialty } : {}),
  });
  return result.items.map(toDoctor);
}

export const getDoctor = async (id) => toDoctor(await get(`/api/v1/doctor-care/doctors/${id}`));

/** Open slots from `from` (default now) for up to 14 days. */
export async function listDoctorSlots(doctorId, from) {
  const start = from ? new Date(Math.max(from.getTime(), Date.now())) : new Date();
  const to = new Date(start.getTime() + 14 * 86400000);
  const result = await get(`/api/v1/doctor-appointments/doctors/${doctorId}/slots`, { from: start.toISOString(), to: to.toISOString() });
  return result.items;
}

// ---------------- Bookings ----------------
const STATUS = {
  REQUESTED: { label: "Awaiting doctor confirmation", tone: "pending" },
  CONFIRMED: { label: "Confirmed", tone: "good" },
  DECLINED: { label: "Declined by doctor", tone: "bad" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  COMPLETED: { label: "Completed", tone: "good" },
};
const ACTIVE = new Set(["REQUESTED", "CONFIRMED"]);

export function toDoctorAppointment(a) {
  const now = Date.now();
  const future = new Date(a.startsAt).getTime() > now;
  const status = STATUS[a.status] || { label: a.status, tone: "neutral" };
  return {
    id: a.id,
    status: a.status,
    statusLabel: a.status === "CANCELLED" && a.cancelledBy === "DOCTOR" ? "Cancelled by doctor" : status.label,
    tone: a.status === "CANCELLED" && a.cancelledBy === "DOCTOR" ? "bad" : status.tone,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    consultationType: a.consultationType,
    typeLabel: CONSULTATION_LABELS[a.consultationType] || "Consultation",
    reason: a.reason,
    decisionReason: a.decisionReason,
    meetingUrl: a.meetingUrl,
    cancelledBy: a.cancelledBy,
    doctorProfileId: a.doctorProfileId,
    doctor: a.doctor || { name: "Doctor" },
    initials: initialsOf(a.doctor?.name),
    forName: a.dependent?.fullName || null,
    active: ACTIVE.has(a.status),
    upcoming: ACTIVE.has(a.status) && new Date(a.endsAt).getTime() > now,
    canChange: ACTIVE.has(a.status) && future,
    // The link is shown from confirmation until the consultation window has passed.
    canJoin: a.status === "CONFIRMED" && a.consultationType === "VIRTUAL" && Boolean(a.meetingUrl) && new Date(a.endsAt).getTime() > now,
  };
}

export async function listMyDoctorAppointments() {
  const result = await get("/api/v1/doctor-appointments/mine", { limit: 100 });
  return result.items.map(toDoctorAppointment);
}

export async function listUpcomingDoctorAppointments() {
  const result = await get("/api/v1/doctor-appointments/mine", { upcoming: "true", limit: 100 });
  return result.items.map(toDoctorAppointment);
}

export const getDoctorAppointment = async (id) => toDoctorAppointment(await get(`/api/v1/doctor-appointments/${id}`));

export const bookDoctor = async ({ slotId, consultationType, reason, dependentId }) =>
  toDoctorAppointment(await post("/api/v1/doctor-appointments", {
    slotId,
    consultationType,
    ...(reason?.trim() ? { reason: reason.trim() } : {}),
    ...(dependentId ? { dependentId } : {}),
  }));

export const cancelDoctorAppointment = async (id, reason) =>
  toDoctorAppointment(await post(`/api/v1/doctor-appointments/${id}/cancel`, reason?.trim() ? { reason: reason.trim() } : {}));

export const rescheduleDoctorAppointment = async (id, { slotId, consultationType }) =>
  toDoctorAppointment(await post(`/api/v1/doctor-appointments/${id}/reschedule`, { slotId, ...(consultationType ? { consultationType } : {}) }));

/** Directions by address (doctors and hospitals have addresses, not coordinates). */
export const mapsSearchUrl = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

// ---------------- Slot grouping for pickers ----------------
export function groupSlotsByDay(slots) {
  const days = new Map();
  for (const slot of slots) {
    const d = new Date(slot.startsAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!days.has(key)) {
      days.set(key, {
        key,
        weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
        day: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        slots: [],
      });
    }
    days.get(key).slots.push({ ...slot, time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) });
  }
  return [...days.values()];
}
