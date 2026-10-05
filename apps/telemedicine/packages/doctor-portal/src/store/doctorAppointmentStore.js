import { createScopedStore } from "./scopedStore.js";
import { getCurrentDoctor, getDoctorId, PRIMARY_DOCTOR_ID } from "./doctorSession.js";
function iso(daysFromToday, hours = 9, minutes = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hours, minutes, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function initials(name) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = ["#0B5E48", "#F5A623", "#5B7FDE", "#B35C9E", "#DE7356"];

const SEED = [
  {
    id: "apt-1",
    patientName: "Sarah Johnson",
    patientAge: 29,
    type: "virtual",
    status: "needs-response",
    requestType: "book-in-advance",
    date: iso(1),
    startTime: "10:00 AM",
    endTime: "10:30 AM",
    bookedBy: "Self",
    reason: "Follow-up on medication dosage.",
  },
  {
    id: "apt-2",
    patientName: "Michael Smith",
    patientAge: 41,
    type: "virtual",
    status: "needs-response",
    requestType: "reschedule-request",
    date: iso(4),
    startTime: "1:00 PM",
    endTime: "1:30 PM",
    previousDate: iso(-1),
    previousStartTime: "2:30 PM",
    bookedBy: "Self",
    reason: "Reschedule requested — work conflict.",
  },
  {
    id: "apt-3",
    patientName: "Eleanor Vance",
    patientAge: 34,
    type: "virtual",
    status: "needs-response",
    requestType: "book-in-advance",
    date: iso(0),
    startTime: "2:30 PM",
    endTime: "3:00 PM",
    bookedBy: "Self",
    reason:
      "I've been experiencing chronic lower back pain for the past two weeks. It's sharp when I stand up after sitting for long periods. I tried over-the-counter pain meds but they aren't helping much anymore. Would like to discuss potential physical therapy or stronger medication options.",
    history: [
      { date: "Aug 15, 2023", label: "Routine Follow-up (Virtual)", note: "Prescribed ibuprofen course for minor strain." },
      { date: "Jan 10, 2023", label: "Initial Consultation (Physical)", note: "" },
    ],
  },
  {
    id: "apt-4",
    patientName: "Tunde Bello",
    patientAge: 52,
    type: "physical",
    bookingSource: "affiliate",
    hospitalName: "St. Nicholas Hospital",
    status: "checked-in",
    date: iso(0),
    startTime: "9:00 AM",
    endTime: "9:30 AM",
    reason: "Hospital Visit",
  },
  {
    id: "apt-5",
    patientName: "Michael Chen",
    patientAge: 8,
    type: "physical",
    bookingSource: "direct",
    status: "active",
    date: iso(0),
    startTime: "1:00 PM",
    endTime: "1:30 PM",
    bookedBy: "Parent (Lisa Chen)",
    address: "House Call",
    reason: "",
  },
  {
    id: "apt-6",
    patientName: "Elena Rodriguez",
    patientAge: 61,
    type: "physical",
    bookingSource: "direct",
    status: "active",
    date: iso(0),
    startTime: "3:30 PM",
    endTime: "5:00 PM",
    address: "124 Maple Street, North District",
    travelMinutes: 20,
    reason: "",
  },
  {
    id: "apt-7",
    patientName: "James Wilson",
    patientAge: 47,
    type: "physical",
    bookingSource: "affiliate",
    hospitalName: "St. Nicholas Hospital",
    status: "active",
    date: iso(0),
    startTime: "1:00 PM",
    endTime: "2:00 PM",
    room: "Room 402",
    reason: "",
  },
  {
    id: "apt-8",
    patientName: "Thomas Shelby",
    patientAge: 38,
    type: "physical",
    bookingSource: "direct",
    status: "active",
    date: iso(1),
    startTime: "10:00 AM",
    endTime: "10:30 AM",
    address: "House Call",
    reason: "",
  },
  {
    id: "apt-9",
    patientName: "Arthur Pendelton",
    patientAge: 66,
    type: "physical",
    bookingSource: "affiliate",
    hospitalName: "St. Nicholas Hospital",
    status: "active",
    date: iso(13),
    startTime: "9:15 AM",
    endTime: "9:45 AM",
    reason: "",
  },
  {
    id: "apt-10",
    patientName: "Funmi Okafor",
    patientAge: 30,
    type: "virtual",
    bookingSource: "direct",
    status: "past",
    date: iso(-6),
    startTime: "11:00 AM",
    endTime: "11:30 AM",
    reason: "Routine check-in.",
  },
  {
    id: "apt-11",
    patientName: "Chidi Musa",
    patientAge: 45,
    type: "physical",
    bookingSource: "affiliate",
    hospitalName: "St. Nicholas Hospital",
    status: "past",
    date: iso(-9),
    startTime: "10:00 AM",
    endTime: "10:30 AM",
    reason: "Post-op review.",
  },
].map((a, i) => ({
  ...a,
  bookingSource: a.bookingSource || "direct",
  initials: initials(a.patientName),
  color: AVATAR_COLORS[i % AVATAR_COLORS.length],
}));


const store = createScopedStore({ key: "sabi-doctor-appointments", seed: () => getDoctorId() === PRIMARY_DOCTOR_ID ? SEED : [], normalize: (rows) => rows.filter((r) => r && typeof r.id === "string" && typeof r.patientName === "string" && typeof r.date === "string" && typeof r.startTime === "string" && ["virtual", "physical", "blocked"].includes(r.type) && (!r.doctorId || r.doctorId === getDoctorId())).map((r) => ({ ...r, doctorId: r.doctorId || getDoctorId() })) });
const persist = store.write;
const notify = store.notify;
export const subscribeToDoctorAppointments = store.subscribe;
export const getDoctorAppointments = store.get;

export function getAppointmentById(id) {
  return getDoctorAppointments().find((a) => a.id === id) || null;
}

export function acceptAppointment(id) {
  return updateAppointment(id, {
    status: "active",
    requestType: null,
    date: undefined, // keep requested date/time as-is
  });
}

export function declineAppointment(id) {
  return updateAppointment(id, { status: "declined" });
}

export function cancelAppointment(id) {
  return updateAppointment(id, { status: "cancelled" });
}

export function updateAppointment(id, patch) {
  if (!getAppointmentById(id)) return null;
  const { id: ignoredId, doctorId: ignoredDoctor, ...safePatch } = patch;
  const cleanPatch = Object.fromEntries(Object.entries(safePatch).filter(([, v]) => v !== undefined));
  const next = getDoctorAppointments().map((a) => (a.id === id ? { ...a, ...cleanPatch } : a));
  persist(next);
  notify();
  return next.find((a) => a.id === id);
}

export function rescheduleAppointment(id, { date, startTime, endTime }) {
  return updateAppointment(id, { date, startTime, endTime, rescheduledAt: new Date().toISOString(), status: "active" });
}

// Blocks a range of time on the doctor's own calendar (from Dashboard's
// "Block Time Off" quick action or Manage Availability's one-off blocks),
// represented as a synthetic appointment so it renders inline in the
// Calendar day view alongside real bookings.
let nextBlockId = 1;
export function addTimeBlock({ date, startTime, endTime, reason }) {
  const block = {
    id: `block-${Date.now()}-${nextBlockId++}`,
    type: "blocked",
    status: "blocked",
    date,
    startTime,
    endTime,
    reason: reason || "Blocked",
    patientName: reason || "Blocked",
  };
  const next = [...getDoctorAppointments(), block];
  persist(next);
  notify();
  return block;
}

export function removeAppointmentOrBlock(id) {
  const next = getDoctorAppointments().filter((a) => a.id !== id);
  persist(next);
  notify();
  return next;
}

export function todayISO() {
  return iso(0);
}
