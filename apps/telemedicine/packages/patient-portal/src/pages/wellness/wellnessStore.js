// Wellness Hub — Caregivers, Nutritionists, Fitness Coaches, Dieticians,
// Therapists, and Health Educators. Unlike a doctor visit, these are
// booked as recurring 30/60-day ENGAGEMENTS: the patient requests a
// duration/schedule shape, the practitioner proposes a concrete
// schedule, and the patient accepts or revises until they agree —
// only then does the engagement actually start.
//
// This store covers the PATIENT side. The practitioner's own response
// (proposing/re-proposing a schedule) is simulated with a short delay,
// same "simulate the other side" pattern used everywhere else in this
// app since there's no practitioner-facing portal yet.

import { syncWellnessEngagement } from "../appointments/appointmentStore";

const REQUESTS_KEY = "sabi-wellness-requests";
const ENGAGEMENTS_KEY = "sabi-wellness-engagements";
const EVENT = "sabi-wellness-updated";

export const CATEGORIES = [
  {
    id: "caregiver",
    label: "Caregivers",
    description: "Home and elderly care",
    supportsPhysical: true,
    rateUnit: "day",
  },
  {
    id: "nutritionist",
    label: "Nutritionists & Dieticians",
    description: "Meal plans and nutrition advice",
    supportsPhysical: false,
    rateUnit: "hour",
  },
  {
    id: "fitness_coach",
    label: "Fitness Coaches",
    description: "Exercise and rehabilitation",
    supportsPhysical: true,
    rateUnit: "hour",
  },
  {
    id: "therapist",
    label: "Therapists",
    description: "Mental health and counseling",
    supportsPhysical: false,
    rateUnit: "hour",
  },
  {
    id: "health_educator",
    label: "Health Educators",
    description: "Lifestyle and disease education",
    supportsPhysical: false,
    rateUnit: "hour",
  },
];

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id) || null;
}

const FIRST_NAMES = ["Ngozi", "Tunde", "Aisha", "Chidinma", "Femi", "Bola", "Kelechi", "Amara", "Yusuf", "Ifeoma", "Segun", "Halima"];
const LAST_NAMES = ["Adeyemi", "Okafor", "Bello", "Eze", "Balogun", "Nwachukwu", "Oyelaran", "Musa", "Ibrahim", "Chukwu"];

function seededPick(list, seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return list[Math.abs(hash) % list.length];
}

const CAREGIVER_SPECIALTIES = ["Elderly Care", "Post-Surgical Recovery", "Mobility Assistance", "Dementia Care", "Live-in Support"];
const FITNESS_SPECIALTIES = ["Weight Loss", "Strength Training", "Post-Injury Rehab", "Prenatal Fitness", "General Fitness"];
const NUTRITION_SPECIALTIES = ["Diabetes Management", "Weight Management", "Sports Nutrition", "Child Nutrition"];
const THERAPY_SPECIALTIES = ["Anxiety & Stress", "Grief Counseling", "Couples Therapy", "Cognitive Behavioral Therapy"];
const EDUCATOR_SPECIALTIES = ["Chronic Disease Management", "Diabetes Education", "Hypertension Education", "Preventive Care"];

function specialtiesFor(categoryId) {
  switch (categoryId) {
    case "caregiver": return CAREGIVER_SPECIALTIES;
    case "fitness_coach": return FITNESS_SPECIALTIES;
    case "nutritionist": return NUTRITION_SPECIALTIES;
    case "therapist": return THERAPY_SPECIALTIES;
    default: return EDUCATOR_SPECIALTIES;
  }
}

const PHOTOS = [
  "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=600&q=80",
  "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=600&q=80",
  "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=600&q=80",
  "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&q=80",
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&q=80",
  "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=600&q=80",
  "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=600&q=80",
  "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&q=80",
];

const BASES = ["Victoria Island", "Lekki Phase 1", "Ikoyi", "Surulere", "Yaba", "Ikeja"];
const NEXT_AVAILABLE = ["Today, 3:00 PM", "Tomorrow, 10:00 AM", "Tomorrow, 2:30 PM", "Wed, 9:00 AM", "Thu, 11:00 AM"];

function buildPractitioner(categoryId, i) {
  const seed = `${categoryId}-${i}`;
  const first = seededPick(FIRST_NAMES, seed);
  const last = seededPick(LAST_NAMES, seed + "x");
  const specialties = specialtiesFor(categoryId);
  const specialty = specialties[i % specialties.length];
  const rating = (4.3 + (Math.abs(seed.length + i) % 7) / 10).toFixed(1);
  const reviews = 20 + (Math.abs(seed.charCodeAt(0) * (i + 1)) % 160);
  const years = 2 + (Math.abs(seed.charCodeAt(1) || 0) % 12);
  const category = getCategory(categoryId);
  const rate = category.rateUnit === "day"
    ? 8000 + (i % 4) * 1500
    : 4000 + (i % 4) * 1000;

  return {
    id: `${categoryId}-${i}`,
    categoryId,
    name: `${first} ${last}`,
    initials: `${first[0]}${last[0]}`,
    photo: seededPick(PHOTOS, seed + "photo"),
    verified: true,
    rating,
    reviews,
    yearsExperience: years,
    specialty,
    specialties: [specialty, specialties[(i + 1) % specialties.length]],
    bio: `${first} has ${years}+ years of experience specializing in ${specialty.toLowerCase()}, focused on attentive, patient-first care.`,
    base: seededPick(BASES, seed + "base"),
    distanceKm: (1 + (Math.abs(seed.charCodeAt(0)) % 9)).toFixed(1),
    nextAvailable: seededPick(NEXT_AVAILABLE, seed + "avail"),
    rate,
    rateUnit: category.rateUnit,
    supportsPhysical: category.supportsPhysical,
    languages: ["English", i % 2 === 0 ? "Yoruba" : i % 3 === 0 ? "Igbo" : "Hausa"],
  };
}

export const PRACTITIONERS = CATEGORIES.flatMap((c) => [0, 1, 2, 3].map((i) => buildPractitioner(c.id, i)));

export function getPractitioners(categoryId) {
  return PRACTITIONERS.filter((p) => p.categoryId === categoryId);
}

export function getPractitioner(id) {
  return PRACTITIONERS.find((p) => p.id === id) || null;
}

// ---------------- Storage plumbing ----------------

function readJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return fallback;
}

function persist(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
  return value;
}

export function subscribeToWellness(listener) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

export function getRequests() {
  return readJSON(REQUESTS_KEY, []);
}

export function getEngagements() {
  return readJSON(ENGAGEMENTS_KEY, []);
}

export function getEngagement(id) {
  return getEngagements().find((e) => e.id === id) || null;
}

function addActivity(engagementId, entry) {
  const engagements = getEngagements();
  const next = engagements.map((e) =>
    e.id === engagementId
      ? { ...e, activity: [{ id: `act-${Date.now()}`, at: new Date().toISOString(), ...entry }, ...(e.activity || [])] }
      : e
  );
  persist(ENGAGEMENTS_KEY, next);
}

// Builds a simple recurring schedule spanning `durationDays`, on the
// given days-of-week (0=Sun..6=Sat), one session per matching day.
function buildSessions({ startDate, durationDays, daysOfWeek, startTime, endTime }) {
  const sessions = [];
  const start = new Date(startDate);
  for (let i = 0; i < durationDays; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (daysOfWeek.includes(d.getDay())) {
      sessions.push({
        id: `sess-${d.toISOString().slice(0, 10)}-${sessions.length}`,
        date: d.toISOString().slice(0, 10),
        dateLabel: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        appointmentDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        startTime,
        endTime,
        status: "upcoming", // upcoming | completed | missed
        checkedInAt: null,
        checkedOutAt: null,
      });
    }
  }
  return sessions;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// Creates a request and kicks off the simulated practitioner response
// (a proposed schedule) after a short delay.
// Creates a request. If this is being booked for an independent (non-
// dependent) family member — other than Caregiver, which blocks this
// entirely at the booking screen — the person being booked for must
// first accept the reservation before the practitioner is even asked
// for a schedule. Once accepted, it proceeds exactly like a normal
// request: the practitioner proposes a schedule after a short delay.
export function createEngagementRequest({
  practitioner,
  bookingFor, // { id, name, isSelf, isDependent }
  durationDays, // 30 | 60
  visitType, // "virtual" | "physical"
  address, // physical only
  dailyStart, // caregiver only
  dailyEnd, // caregiver only
  sessionHours, // non-caregiver
  daysOfWeek, // non-caregiver — array of 0-6
  goal, // fitness only
}) {
  const isCaregiver = practitioner.categoryId === "caregiver";
  const totalCost = isCaregiver
    ? practitioner.rate * durationDays
    : practitioner.rate * sessionHours * Math.round((daysOfWeek.length * durationDays) / 7);

  const needsMemberAcceptance = !bookingFor.isSelf && bookingFor.isDependent === false;

  const request = {
    id: `req-${Date.now()}`,
    practitionerId: practitioner.id,
    practitionerName: practitioner.name,
    categoryId: practitioner.categoryId,
    bookingForId: bookingFor.id,
    bookingForName: bookingFor.name,
    durationDays,
    visitType,
    address: address || null,
    dailyStart: dailyStart || null,
    dailyEnd: dailyEnd || null,
    sessionHours: sessionHours || null,
    daysOfWeek: daysOfWeek || ALL_DAYS,
    goal: goal || null,
    totalCost,
    status: needsMemberAcceptance ? "awaiting_member_acceptance" : "awaiting_proposal",
    // Independent (non-dependent) family member: they review and agree
    // the schedule themselves — the booker never sees the proposal
    // review step for this request, only the eventual outcome.
    bookedForIndependent: needsMemberAcceptance,
    createdAt: new Date().toISOString(),
    proposal: null,
    revisionNote: null,
  };

  const next = [request, ...getRequests()];
  persist(REQUESTS_KEY, next);

  // No practitioner exists to actually respond yet (BACKEND REQUIRED) — the
  // request stays "awaiting_proposal" / "awaiting_member_acceptance" until a
  // real practitioner-facing system calls proposeSchedule, rather than that
  // being faked on a timer here.

  return request;
}

// The person a request was booked FOR (not the booker) accepting or
// declining the reservation itself — this happens before the
// practitioner is ever asked to propose a schedule. There's no
// separate login for them yet, so this is exposed as an explicit
// action the booker can trigger on that member's behalf — a real,
// deliberate action, not an automatic simulation.
export function respondToEngagementInvite(requestId, accepted) {
  const requests = getRequests();
  const request = requests.find((r) => r.id === requestId);
  if (!request || request.status !== "awaiting_member_acceptance") return;

  if (!accepted) {
    const declined = requests.map((r) => (r.id === requestId ? { ...r, status: "declined_by_member" } : r));
    persist(REQUESTS_KEY, declined);
    return;
  }

  // Moves to "awaiting_proposal" — genuinely pending until a real
  // practitioner-facing system proposes a schedule (BACKEND REQUIRED).
  const accepted_ = requests.map((r) => (r.id === requestId ? { ...r, status: "awaiting_proposal" } : r));
  persist(REQUESTS_KEY, accepted_);
}

function proposeSchedule(requestId) {
  const requests = getRequests();
  const request = requests.find((r) => r.id === requestId);
  if (!request) return;

  const isCaregiver = request.categoryId === "caregiver";
  const sessions = buildSessions({
    startDate: new Date(Date.now() + 2 * 86400000), // starts in 2 days
    durationDays: request.durationDays,
    daysOfWeek: isCaregiver ? ALL_DAYS : request.daysOfWeek,
    startTime: isCaregiver ? request.dailyStart : null,
    endTime: isCaregiver ? request.dailyEnd : null,
  });

  const updated = requests.map((r) =>
    r.id === requestId
      ? { ...r, status: "awaiting_client_review", proposal: { sessions, proposedAt: new Date().toISOString() } }
      : r
  );
  persist(REQUESTS_KEY, updated);

  // Booked for an independent family member — they review and agree the
  // proposed schedule themselves, not the booker. There's no separate
  // login for them yet, so this stays "awaiting_client_review" until
  // that member's own review is connected (BACKEND REQUIRED) rather
  // than being finalized automatically on their behalf.
}

// Shared by both the booker manually accepting/editing a proposal
// (self or dependent bookings) and the auto-resolve path for an
// independent member reviewing their own schedule.
function finalizeEngagement(requestId, sessions) {
  const requests = getRequests();
  const request = requests.find((r) => r.id === requestId);
  if (!request) return null;

  const engagement = {
    id: `eng-${Date.now()}`,
    practitionerId: request.practitionerId,
    practitionerName: request.practitionerName,
    categoryId: request.categoryId,
    bookingForId: request.bookingForId,
    bookingForName: request.bookingForName,
    durationDays: request.durationDays,
    visitType: request.visitType,
    address: request.address,
    totalCost: request.totalCost,
    goal: request.goal,
    status: "active", // active | awaiting_renewal | completed | cancelled
    startedAt: new Date().toISOString(),
    sessions,
    activity: [
      {
        id: `act-${Date.now()}`,
        at: new Date().toISOString(),
        type: "started",
        description: request.bookedForIndependent
          ? `${request.bookingForName} reviewed and confirmed the schedule with ${request.practitionerName} — engagement started.`
          : `Engagement with ${request.practitionerName} started — schedule agreed for ${request.durationDays} days.`,
      },
    ],
  };

  persist(ENGAGEMENTS_KEY, [engagement, ...getEngagements()]);
  persist(REQUESTS_KEY, getRequests().filter((r) => r.id !== requestId));
  syncWellnessEngagement(engagement);

  return engagement;
}

// Patient accepts the proposed schedule — creates the real Engagement.
// If `editedSessions` is passed (the patient dropped some proposed
// sessions and/or added their own), that list is used instead of the
// practitioner's original proposal — a simpler substitute for a full
// text-based negotiation round-trip. Only used for self/dependent
// bookings — see proposeSchedule for the independent-member path.
export function acceptProposal(requestId, editedSessions) {
  const requests = getRequests();
  const request = requests.find((r) => r.id === requestId);
  if (!request || !request.proposal) return null;

  const sessions = editedSessions && editedSessions.length ? editedSessions : request.proposal.sessions;
  return finalizeEngagement(requestId, sessions);
}

// Patient requests changes instead of accepting — sends it back to the
// practitioner for a fresh proposal (BACKEND REQUIRED; stays genuinely
// pending here rather than re-proposing on a timer).
export function reviseProposal(requestId, note) {
  const requests = getRequests();
  const updated = requests.map((r) =>
    r.id === requestId ? { ...r, status: "awaiting_proposal", revisionNote: note, proposal: null } : r
  );
  persist(REQUESTS_KEY, updated);
}

export function cancelRequest(requestId) {
  persist(REQUESTS_KEY, getRequests().filter((r) => r.id !== requestId));
}

// ---------------- Check-in / check-out (patient-visible) ----------------

export function checkInSession(engagementId, sessionId) {
  const engagements = getEngagements();
  const engagement = engagements.find((e) => e.id === engagementId);
  if (!engagement) return;
  const next = engagements.map((e) =>
    e.id === engagementId
      ? { ...e, sessions: e.sessions.map((s) => (s.id === sessionId ? { ...s, checkedInAt: new Date().toISOString() } : s)) }
      : e
  );
  persist(ENGAGEMENTS_KEY, next);
  addActivity(engagementId, {
    type: "check_in",
    description: `${engagement.practitionerName} checked in`,
  });
}

export function checkOutSession(engagementId, sessionId) {
  const engagements = getEngagements();
  const engagement = engagements.find((e) => e.id === engagementId);
  if (!engagement) return;
  const next = engagements.map((e) =>
    e.id === engagementId
      ? {
          ...e,
          sessions: e.sessions.map((s) =>
            s.id === sessionId ? { ...s, checkedOutAt: new Date().toISOString(), status: "completed" } : s
          ),
        }
      : e
  );
  persist(ENGAGEMENTS_KEY, next);
  addActivity(engagementId, {
    type: "check_out",
    description: `${engagement.practitionerName} checked out`,
  });
  const updatedEngagement = next.find((e) => e.id === engagementId);
  if (updatedEngagement) syncWellnessEngagement(updatedEngagement);
}

export function cancelEngagement(engagementId, reason) {
  const engagements = getEngagements();
  const next = engagements.map((e) =>
    e.id === engagementId ? { ...e, status: "cancelled", cancelReason: reason || "" } : e
  );
  persist(ENGAGEMENTS_KEY, next);
  addActivity(engagementId, { type: "cancelled", description: `Engagement cancelled${reason ? `: ${reason}` : ""}` });
  const cancelled = next.find((e) => e.id === engagementId);
  if (cancelled) syncWellnessEngagement(cancelled);
}

const CATEGORY_LABELS = {
  caregiver: "Caregiver",
  nutritionist: "Nutritionist / Dietician",
  fitness_coach: "Fitness Coach",
  therapist: "Therapist",
  health_educator: "Health Educator",
};

const CATEGORY_COLORS = ["#0B5E48", "#14B586", "#F5A623", "#073D30"];

// Surfaces every not-yet-completed session across active Wellness Hub
// engagements in the same shape the Appointments page already reads
// (see appointmentStore.js) — so a caregiver/therapist/etc. session
// shows up in My Appointments exactly like a doctor or hospital visit,
// instead of only ever being visible inside Wellness Hub.
export function getSessionAppointments() {
  const engagements = getEngagements().filter((e) => e.status === "active" || e.status === "awaiting_renewal");
  const appointments = [];

  engagements.forEach((engagement, ei) => {
    const initials = engagement.practitionerName
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2);

    engagement.sessions
      .filter((s) => s.status === "upcoming")
      .forEach((session) => {
        appointments.push({
          id: `wellness-${session.id}`,
          doctor: engagement.practitionerName,
          initials,
          color: CATEGORY_COLORS[ei % CATEGORY_COLORS.length],
          specialty: CATEGORY_LABELS[engagement.categoryId] || "Wellness",
          location: engagement.visitType === "physical" && engagement.address ? engagement.address.address : "Virtual session",
          lat: null,
          lng: null,
          date: session.appointmentDate || session.dateLabel,
          time: session.startTime ? `${session.startTime}${session.endTime ? `-${session.endTime}` : ""}` : "",
          status: "active",
          virtual: engagement.visitType === "virtual",
          bookedFor: engagement.bookingForName,
          wellnessEngagementId: engagement.id,
          wellnessSessionId: session.id,
        });
      });
  });

  return appointments;
}
