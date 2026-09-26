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

// ---------------- Adapter for the Find Your Doctor UI ----------------
// The page's components read these field names; values come only from what the doctor published.
const whenLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
  return `${d.toLocaleDateString("en-US", { weekday: "long" })}, ${time}`;
};

/** Takes a doctor already mapped by toDoctor. */
export const toUiDoctor = (d) => {
  return {
    ...d,
    experience: d.yearsOfExperience,
    clinic: d.practiceName || d.practiceAddress || "",
    distance: null,
    nextAvailable: d.nextAvailableAt ? whenLabel(d.nextAvailableAt) : "No open times yet",
    rating: "New",
    photo: null,
    title: d.specialty,
    patients: null,
    about: d.bio || `${d.name} hasn't added a profile summary yet.`,
    education: "Not provided yet",
    certifications: "Verified by Sabi Health",
    expertise: [d.specialty],
    affiliations: d.practiceName ? [{ name: d.practiceName, role: d.practiceAddress || "Practice" }] : [],
  };
};

export async function listUiDoctors() {
  return (await listDoctors()).map(toUiDoctor);
}

// ---------------- Adapter for the Appointments UI ----------------
// Maps a booking onto the fields/statuses the Appointments components read.
const AVATAR_COLORS = ["#0B5E48", "#F5A623", "#E53935", "#073D30"];
const byDoctor = (a) => {
  const ended = new Date(a.endsAt).getTime() <= Date.now();
  if (a.status === "REQUESTED") return ended ? "missed" : "pending-review";
  if (a.status === "CONFIRMED") return ended ? "missed" : "active";
  if (a.status === "COMPLETED") return "completed";
  return "cancelled"; // CANCELLED or DECLINED
};

export function toUiAppointment(api) {
  const a = toDoctorAppointment(api);
  const start = new Date(a.startsAt);
  const byWho = a.status === "DECLINED" ? "Declined by the doctor" : a.status === "CANCELLED" && a.cancelledBy === "DOCTOR" ? "Cancelled by the doctor" : null;
  return {
    ...a,
    apiStatus: a.status,
    status: byDoctor(a),
    doctor: a.doctor.name,
    doctorInfo: a.doctor,
    color: AVATAR_COLORS[[...(a.doctorProfileId || a.id)].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_COLORS.length],
    specialty: a.doctor.specialty,
    location: a.consultationType === "VIRTUAL" ? "Video consultation" : [a.doctor.practiceName, a.doctor.practiceAddress].filter(Boolean).join(", ") || "In-person visit",
    address: a.doctor.practiceAddress || null,
    date: start.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
    time: start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    virtual: a.consultationType === "VIRTUAL",
    bookedFor: a.forName || undefined,
    rescheduleNote: a.status === "REQUESTED" ? "Pending Review — waiting for the doctor to confirm" : undefined,
    visitNote: a.consultationType === "IN_PERSON" ? `Visit at ${a.doctor.practiceName || "the practice"}` : undefined,
    declineNote: byWho ? `${byWho}${a.decisionReason ? `: ${a.decisionReason}` : ""}` : undefined,
  };
}

export const getUiAppointment = async (id) => toUiAppointment(await get(`/api/v1/doctor-appointments/${id}`));

export async function listUiAppointments() {
  const result = await get("/api/v1/doctor-appointments/mine", { limit: 100 });
  return result.items.map(toUiAppointment);
}
