import { UPCOMING_APPOINTMENTS } from "./data";

// Appointments used to live only in Appointments.jsx's local useState,
// seeded from the static UPCOMING_APPOINTMENTS list — so an appointment
// booked anywhere else (e.g. the "Find Your Doctor" booking modal) had
// nowhere real to go. This store (localStorage, same pattern as
// prescriptionStore.js / cartStore.js / familyStore.js) is the shared
// source of truth instead, seeded once from UPCOMING_APPOINTMENTS.

const KEY = "sabi-appointments";
let listeners = [];

function seedIfEmpty() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  const seeded = UPCOMING_APPOINTMENTS.map((appointment) => ({ ...appointment }));
  persist(seeded);
  return seeded;
}

function persist(list) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeToAppointments(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function getAppointments() {
  return seedIfEmpty();
}

const AVATAR_COLORS = ["#0B5E48", "#F5A623", "#E53935", "#073D30"];
let nextId = 1;

// Builds a store-shaped appointment record from a doctor + booking
// selection (used by the "Find Your Doctor" BookingModal) and appends it.
// `bookingFor` (optional) is the family member this was booked for —
// {id, name, isSelf, isDependent}. Dependents show up on the calendar
// immediately; a non-dependent (their own account) needs to accept the
// reservation first, same pattern as the hospital family-plan flow.
export function addAppointmentFromBooking(doctor, { date, time, type, address, bookingFor }) {
  const initials = doctor.name
    .replace("Dr. ", "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  const bookedDate = date?.key
    ? new Date(date.key).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : date instanceof Date
    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : date;

  const isForOther = bookingFor && !bookingFor.isSelf;
  const needsAcceptance = isForOther && bookingFor.isDependent === false;

  const appointment = {
    id: `apt-doctor-${Date.now()}-${nextId++}`,
    doctor: doctor.name,
    initials,
    color: AVATAR_COLORS[getAppointments().length % AVATAR_COLORS.length],
    specialty: doctor.specialty,
    location: type === "in-person" && address ? address.address : doctor.clinic,
    lat: doctor.clinicLat,
    lng: doctor.clinicLng,
    date: bookedDate,
    time,
    status: needsAcceptance ? "awaiting-acceptance" : "active",
    virtual: type === "virtual",
    address: type === "in-person" ? address : null,
    bookedFor: isForOther ? bookingFor.name : undefined,
    bookedForId: isForOther ? bookingFor.id : undefined,
  };

  const next = [appointment, ...getAppointments()];
  persist(next);
  notify();
  return appointment;
}

// Simulates the family member's response to a reservation made on their
// behalf. There's no separate login for them in this app, so this is
// surfaced as an action on the appointment itself.
export function respondToBookingRequest(id, accepted) {
  return updateAppointment(id, { status: accepted ? "active" : "declined-by-member" });
}

export function addAppointment(appointment) {
  const next = [...getAppointments(), appointment];
  persist(next);
  notify();
  return appointment;
}

// "Book in Advance" — the patient requests a date beyond the doctor's
// published 6-day availability window. There's no doctor portal yet to
// action the request, so it sits as "pending-review" until Phase 2 adds
// the doctor-side accept/decline/counter-propose flow described in the
// scheduling PRD.
export function addAppointmentRequest(doctor, { date, time, type, reason, notes }) {
  const initials = doctor.name
    .replace("Dr. ", "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  const dateLabel = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : date;

  const timeLabel = time
    ? new Date(`2000-01-01T${time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : time;

  const appointment = {
    id: `apt-request-${Date.now()}-${nextId++}`,
    doctor: doctor.name,
    initials,
    color: AVATAR_COLORS[getAppointments().length % AVATAR_COLORS.length],
    specialty: doctor.specialty,
    location: doctor.clinic,
    lat: doctor.clinicLat,
    lng: doctor.clinicLng,
    date: dateLabel,
    time: timeLabel,
    status: "pending-review",
    virtual: type === "virtual",
    reason,
    notes,
    requestedAt: new Date().toISOString(),
  };

  const next = [appointment, ...getAppointments()];
  persist(next);
  notify();
  return appointment;
}

// Books an appointment with a specialist at a hospital (from the Book
// Hospital Appointment flow) — same store, same appointment shape, so
// it shows up in My Appointments and check-in alongside doctor bookings.
export function addHospitalAppointment({ hospital, specialist, department, date, time, type, reason }) {
  const initials = (specialist?.name || hospital.name)
    .replace("Dr. ", "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  const appointment = {
    id: `apt-hospital-${Date.now()}-${nextId++}`,
    doctor: specialist?.name || `${hospital.name} — ${department}`,
    initials,
    color: AVATAR_COLORS[getAppointments().length % AVATAR_COLORS.length],
    specialty: specialist?.title || department,
    location: hospital.name,
    lat: hospital.lat,
    lng: hospital.lng,
    hospitalId: hospital.id,
    date,
    time,
    status: "active",
    virtual: type === "virtual",
    reason,
  };

  const next = [appointment, ...getAppointments()];
  persist(next);
  notify();
  return appointment;
}

// "Book in Advance" for a hospital appointment — same idea as the doctor
// version: request a date beyond the standard availability window, sits
// as "pending-review" until Phase 2 adds the hospital-side response flow.
export function addHospitalAppointmentRequest({ hospital, department, memberName, date, time, type, reason }) {
  const initials = `${hospital.name} — ${department}`
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  const dateLabel = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : date;
  const timeLabel = time
    ? new Date(`2000-01-01T${time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : time;

  const appointment = {
    id: `apt-hospital-request-${Date.now()}-${nextId++}`,
    doctor: `${hospital.name} — ${department}`,
    initials,
    color: AVATAR_COLORS[getAppointments().length % AVATAR_COLORS.length],
    specialty: department,
    location: hospital.name,
    lat: hospital.lat,
    lng: hospital.lng,
    hospitalId: hospital.id,
    date: dateLabel,
    time: timeLabel,
    status: "pending-review",
    virtual: type === "virtual",
    reason,
    bookedFor: memberName,
    requestedAt: new Date().toISOString(),
  };

  const next = [appointment, ...getAppointments()];
  persist(next);
  notify();
  return appointment;
}

// Standard reschedule — the new date/time is available right away, so
// the appointment is simply updated in place and stays "active".
export function rescheduleAppointment(id, { date, time }) {
  return updateAppointment(id, { date, time, rescheduleNote: null });
}

// "Book in Advance" reschedule — the requested date is outside the
// standard window, so (same pattern as a fresh advance booking) it
// drops back to "pending-review" instead of confirming immediately.
export function requestRescheduleInAdvance(id, { date, time, reason }) {
  const appointments = getAppointments();
  const current = appointments.find((a) => a.id === id);
  if (!current) return null;

  const dateLabel = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : date;
  const timeLabel = time
    ? new Date(`2000-01-01T${time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : time;

  return updateAppointment(id, {
    status: "pending-review",
    date: dateLabel,
    time: timeLabel,
    reason: reason || current.reason,
    previousDate: current.date,
    previousTime: current.time,
    rescheduleNote: `Reschedule requested from ${current.date} · ${current.time}`,
    requestedAt: new Date().toISOString(),
  });
}

// Wellness Hub bookings (caregivers, nutritionists, fitness coaches,
// therapists, health educators) are recurring engagements made of many
// individual sessions — far too many to dump into the shared
// Appointments list one row per session. Instead, each engagement gets
// exactly ONE representative row here (linked via wellnessEngagementId,
// so re-syncing updates it in place instead of duplicating), showing
// its next upcoming session. The full session-by-session schedule
// still lives in Wellness Hub — this is just what makes the engagement
// show up on the shared Appointments page at all, alongside doctor and
// hospital bookings.
export function syncWellnessEngagement(engagement) {
  const nextSession = engagement.sessions.find((s) => s.status !== "completed") || engagement.sessions[0];
  if (!nextSession) return null;

  const initials = engagement.practitionerName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  const shaped = {
    id: `apt-wellness-${engagement.id}`,
    doctor: engagement.practitionerName,
    initials,
    color: AVATAR_COLORS[getAppointments().length % AVATAR_COLORS.length],
    specialty: `Wellness · ${engagement.categoryId.replace("_", " ")}`,
    location: engagement.visitType === "physical" ? (engagement.address?.address || "In-person visit") : "Virtual session",
    date: nextSession.dateLabel,
    time: nextSession.startTime ? `${nextSession.startTime}${nextSession.endTime ? `-${nextSession.endTime}` : ""}` : "Virtual",
    status: engagement.status === "cancelled" ? "cancelled" : engagement.status === "completed" ? "completed" : "active",
    virtual: engagement.visitType === "virtual",
    bookedFor: engagement.bookingForName,
    wellnessEngagementId: engagement.id,
  };

  const existing = getAppointments();
  const already = existing.find((a) => a.wellnessEngagementId === engagement.id);
  const next = already
    ? existing.map((a) => (a.wellnessEngagementId === engagement.id ? { ...a, ...shaped, id: a.id } : a))
    : [shaped, ...existing];

  persist(next);
  notify();
  return shaped;
}

export function cancelAppointment(id) {
  const next = getAppointments().filter((appointment) => appointment.id !== id);
  persist(next);
  notify();
  return next;
}

export function updateAppointment(id, patch) {
  const next = getAppointments().map((appointment) =>
    appointment.id === id ? { ...appointment, ...patch } : appointment
  );
  persist(next);
  notify();
  return next.find((appointment) => appointment.id === id);
}
