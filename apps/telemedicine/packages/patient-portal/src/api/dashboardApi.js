// Dashboard widgets. Each card loads from the same API its full page uses, so the dashboard
// can never disagree with Appointments, Records, Vitals or Family.
import { authorizedRequest } from "../utils/sabiIdentity";
import { listMyHospitalAppointments, listMyWellnessBookings } from "./sabiApi";
import { toRecord } from "./recordsApi";
import { listUpcomingDoctorAppointments } from "./doctorsApi";

const data = async (promise) => (await promise).data;

// ---------------- Schedule ----------------
const ACTIVE_HOSPITAL = new Set(["PENDING", "SCHEDULED", "CHECKED_IN"]);
const ACTIVE_WELLNESS = new Set(["PENDING", "CONFIRMED"]);
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Upcoming doctor bookings, hospital appointments and wellness sessions (today onwards), soonest first. */
export async function getUpcomingSchedule() {
  const [hospital, wellness, doctor] = await Promise.all([listMyHospitalAppointments(), listMyWellnessBookings(), listUpcomingDoctorAppointments()]);
  const from = startOfToday();
  const items = [
    ...doctor.map((a) => ({
      id: `d-${a.id}`,
      at: a.startsAt,
      title: `${a.typeLabel} · ${a.doctor.name}`,
      sub: [a.forName && `For ${a.forName}`, a.statusLabel].filter(Boolean).join(" · "),
      to: "/appointments",
    })),
    ...hospital
      .filter((a) => ACTIVE_HOSPITAL.has(a.status))
      .map((a) => ({
        id: `h-${a.id}`,
        at: a.requestedAt,
        title: `${a.appointmentType} · ${a.hospitalName || "Hospital"}`,
        sub: [a.memberName && `For ${a.memberName}`, a.statusLabel].filter(Boolean).join(" · "),
        to: a.status === "SCHEDULED" ? `/hospitals/check-in/${a.id}` : "/appointments",
      })),
    ...(wellness.items || [])
      .filter((b) => ACTIVE_WELLNESS.has(b.status))
      .map((b) => ({
        id: `w-${b.id}`,
        at: b.requestedAt,
        title: b.offering?.name || "Wellness session",
        sub: b.status === "CONFIRMED" ? "Wellness · Confirmed" : "Wellness · Awaiting provider confirmation",
        to: `/wellness-hub/engagements/${b.id}`,
      })),
  ];
  return items.filter((i) => new Date(i.at) >= from).sort((a, b) => new Date(a.at) - new Date(b.at));
}

// ---------------- Records ----------------
export async function recentRecords(limit = 5) {
  const result = await data(authorizedRequest("/api/v1/medical-records", { query: { limit, sort: "desc" } }));
  return result.items.map(toRecord);
}

// ---------------- Medications ----------------
// A daily medication list: name, time of day (HH:MM) and whether it has been taken.
export async function listMedications() {
  const result = await data(authorizedRequest("/api/v1/medications", { query: { limit: 100, sort: "asc" } }));
  return result.items;
}

export const setMedicationTaken = (id, isTaken) =>
  data(authorizedRequest(`/api/v1/medications/${id}/taken`, { method: "PATCH", body: { isTaken } }));

export const addMedication = ({ name, time, instructions }) =>
  data(
    authorizedRequest("/api/v1/medications", {
      method: "POST",
      body: { name: name.trim(), time, ...(instructions?.trim() ? { instructions: instructions.trim() } : {}) },
    }),
  );

/** "08:30" -> "8:30 AM" in the patient's locale. */
export const formatClock = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};
