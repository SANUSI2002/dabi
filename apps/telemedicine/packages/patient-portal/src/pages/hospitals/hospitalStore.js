// Static hospital directory for the Hospitals feature. Shaped so a real
// /hospitals API response could be dropped in later without touching
// the pages that consume it.

export const HOSPITALS = [
  {
    id: "lagos-city",
    name: "Lagos City Hospital",
    area: "Victoria Island, Lagos",
    address: "12 Ozumba Mbadiwe Avenue, Victoria Island, Lagos",
    phone: "+234 700 000 1000",
    hours: "24 hours (Emergency) · Clinics 8am–6pm Mon–Sat",
    description:
      "A leading private tertiary hospital known for its cardiology and orthopedics units, serving Victoria Island and the wider Lagos mainland for over two decades.",
    amenities: ["24/7 Emergency Room", "On-site Pharmacy", "Diagnostic Imaging (CT/MRI)", "Private Wards", "Free Parking"],
    insurancePartners: ["NHIS", "AXA Mansard", "Hygeia HMO", "Reliance HMO"],
    yearsOperation: 22,
    type: "Private Tertiary",
    specialistCount: 40,
    rating: "4.9",
    distanceKm: 2.4,
    insuranceAccepted: true,
    hasER: true,
    lat: 6.4281,
    lng: 3.4219,
    departments: ["Cardiology", "General Practice", "Pediatrics", "Orthopedics", "ENT"],
    plans: [
      { id: "standard", name: "Standard Plan", type: "individual", fee: 15000, description: "Covers one person." },
      { id: "family", name: "Family Plan", type: "family", fee: 35000, maxMembers: 5, description: "Covers you plus up to 5 family members." },
    ],
  },
  {
    id: "evercare-lekki",
    name: "Evercare Hospital Lekki",
    area: "Lekki Phase 1, Lagos",
    address: "1 Admiralty Way, Lekki Phase 1, Lagos",
    phone: "+234 700 000 2000",
    hours: "24 hours (Emergency) · Clinics 8am–7pm Mon–Sat",
    description:
      "A modern multi-specialty hospital with 65+ specialists across cardiology, neurology, and dermatology, built around fast digital-first patient care.",
    amenities: ["24/7 Emergency Room", "On-site Pharmacy", "Maternity Suite", "Diagnostic Lab", "Valet Parking"],
    insurancePartners: ["NHIS", "AXA Mansard", "AIICO", "Leadway Health"],
    yearsOperation: 5,
    type: "Multi-Specialty",
    specialistCount: 65,
    rating: "4.8",
    distanceKm: 4.1,
    insuranceAccepted: true,
    hasER: true,
    lat: 6.4478,
    lng: 3.4726,
    departments: ["Cardiology", "Neurology", "Pediatrics", "General Practice", "Dermatology"],
    plans: [
      { id: "standard", name: "Standard Plan", type: "individual", fee: 15000, description: "Covers one person." },
      { id: "family", name: "Family Plan", type: "family", fee: 35000, maxMembers: 5, description: "Covers you plus up to 5 family members." },
    ],
  },
  {
    id: "reddington",
    name: "Reddington Hospital",
    area: "Victoria Island, Lagos",
    address: "12 Idowu Martins Street, Victoria Island, Lagos",
    phone: "+234 700 000 3000",
    hours: "24 hours (Emergency) · Clinics 8am–6pm Mon–Sat",
    description:
      "A well-established private tertiary hospital offering pediatrics, cardiology, and orthopedics with a strong reputation for family care.",
    amenities: ["24/7 Emergency Room", "On-site Pharmacy", "Pediatric Ward", "Diagnostic Imaging", "Free Parking"],
    insurancePartners: ["NHIS", "Hygeia HMO", "Reliance HMO"],
    yearsOperation: 15,
    type: "Private Tertiary",
    specialistCount: 55,
    rating: "4.8",
    distanceKm: 3.2,
    insuranceAccepted: true,
    hasER: true,
    lat: 6.4304,
    lng: 3.4207,
    departments: ["Pediatrics", "Cardiology", "Orthopedics", "General Practice"],
    plans: [
      { id: "standard", name: "Standard Plan", type: "individual", fee: 12000, description: "Covers one person." },
      { id: "family", name: "Family Plan", type: "family", fee: 30000, maxMembers: 5, description: "Covers you plus up to 5 family members." },
    ],
  },
  {
    id: "lagoon",
    name: "Lagoon Hospital",
    area: "Ikoyi, Lagos",
    address: "8 Marine Road, Apapa, Lagos",
    phone: "+234 700 000 4000",
    hours: "24 hours (Emergency) · Clinics 8am–6pm Mon–Fri",
    description:
      "A long-standing private hospital with a strong maternity and orthopedics program, trusted across Lagos for over 30 years.",
    amenities: ["Maternity Suite", "On-site Pharmacy", "Diagnostic Lab", "Private Wards", "Free Parking"],
    insurancePartners: ["NHIS", "AXA Mansard", "AIICO"],
    yearsOperation: 30,
    type: "Private Tertiary",
    specialistCount: 70,
    rating: "4.6",
    distanceKm: 5.6,
    insuranceAccepted: true,
    hasER: false,
    lat: 6.4541,
    lng: 3.4316,
    departments: ["Maternity", "Orthopedics", "General Practice", "Pediatrics"],
    plans: [
      { id: "standard", name: "Standard Plan", type: "individual", fee: 14000, description: "Covers one person." },
      { id: "family", name: "Family Plan", type: "family", fee: 32000, maxMembers: 5, description: "Covers you plus up to 5 family members." },
    ],
  },
  {
    id: "st-nicholas",
    name: "St. Nicholas Hospital",
    area: "Lagos Island, Lagos",
    address: "6 Campbell Street, Lagos Island, Lagos",
    phone: "+234 700 000 5000",
    hours: "24 hours (Emergency) · Clinics 8am–5pm Mon–Sat",
    description:
      "One of Lagos's oldest private hospitals, offering general practice, cardiology, and ENT care on a self-pay basis.",
    amenities: ["24/7 Emergency Room", "On-site Pharmacy", "Diagnostic Lab"],
    insurancePartners: [],
    yearsOperation: 45,
    type: "Private Tertiary",
    specialistCount: 38,
    rating: "4.5",
    distanceKm: 6.8,
    insuranceAccepted: false,
    hasER: true,
    lat: 6.4552,
    lng: 3.3941,
    departments: ["General Practice", "Cardiology", "ENT"],
    plans: [
      { id: "standard", name: "Standard Plan", type: "individual", fee: 10000, description: "Covers one person." },
    ],
  },
];

export function getHospital(id) {
  return HOSPITALS.find((h) => h.id === id) || null;
}

const SPECIALIST_FIRST_NAMES = ["Samuel", "Aisha", "Chidinma", "Tunde", "Ngozi", "Femi", "Kelechi", "Bola"];
const SPECIALIST_LAST_NAMES = ["Okafor", "Bello", "Adeyemi", "Eze", "Balogun", "Nwachukwu", "Oyelaran", "Musa"];
const SPECIALIST_BIOS = [
  "Focuses on evidence-based, patient-first care with a calm, thorough bedside manner.",
  "Combines the latest diagnostic techniques with a preventive-care mindset.",
  "Known for taking time to explain conditions clearly before recommending treatment.",
  "Specializes in managing chronic conditions alongside day-to-day patient wellbeing.",
];

function seededPick(list, seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return list[Math.abs(hash) % list.length];
}

// Deterministic mock specialists per hospital/department so the same
// pair of names always shows up for a given combination (no backend yet).
export function getSpecialistsForHospital(hospitalId, department) {
  return [0, 1].map((i) => {
    const seed = `${hospitalId}-${department}-${i}`;
    const first = seededPick(SPECIALIST_FIRST_NAMES, seed);
    const last = seededPick(SPECIALIST_LAST_NAMES, seed + "x");
    const rating = (4.4 + (Math.abs(seed.length + i) % 6) / 10).toFixed(1);
    const reviews = 60 + (Math.abs(seed.charCodeAt(0) * (i + 1)) % 180);
    const yearsExperience = 6 + (Math.abs(seed.charCodeAt(1) || 0) % 14);
    return {
      id: `${hospitalId}-${department}-${i}`.toLowerCase().replace(/\s+/g, "-"),
      name: `Dr. ${first} ${last}`,
      title: i === 0 ? `Senior ${department} Specialist` : `${department} Consultant`,
      rating,
      reviews,
      yearsExperience,
      bio: seededPick(SPECIALIST_BIOS, seed + "bio"),
    };
  });
}

// ---------------- Enrollments ----------------
// One record per (memberId, hospitalId) — the same member can be
// enrolled at more than one hospital. A Family Plan enrollment creates
// one record per covered member, linked via familyPlanOwnerId so they
// can be shown together (e.g. on the Family Hospital Enrollment page).

const ENROLLMENTS_KEY = "sabi-hospital-enrollments";
const EVENT = "sabi-hospital-enrollments-updated";

function getStored() {
  try {
    const raw = window.localStorage.getItem(ENROLLMENTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return [];
}

function persist(list) {
  try {
    window.localStorage.setItem(ENROLLMENTS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
  return list;
}

export function subscribeToEnrollments(listener) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

export function getEnrollments() {
  return getStored();
}

export function getEnrollmentsForMember(memberId) {
  return getStored().filter((e) => e.memberId === memberId);
}

export function getEnrollment(memberId, hospitalId) {
  return getStored().find((e) => e.memberId === memberId && e.hospitalId === hospitalId) || null;
}

export function isEnrolled(memberId, hospitalId) {
  return getEnrollment(memberId, hospitalId)?.status === "Enrolled";
}

// Everyone covered under a given family-plan enrollment (the owner's
// record plus every record it added).
export function getFamilyPlanMembers(ownerEnrollmentId) {
  return getStored().filter((e) => e.familyPlanOwnerId === ownerEnrollmentId);
}

// Creates a pending enrollment. It stays genuinely pending — there is no
// hospital-facing portal or backend yet to actually review and approve it,
// so nothing here fabricates that approval on a timer. When the chosen
// plan is a Family Plan, `includedMembers` ([{id, name}]) each get
// their own linked enrollment record under the same plan.
export function enrollMember({ memberId, memberName, hospitalId, planId, personal, medical, consent, includedMembers = [] }) {
  const hospital = getHospital(hospitalId);
  const plan = hospital?.plans.find((p) => p.id === planId) || hospital?.plans[0];

  const ownerId = `enr-${Date.now()}`;
  const baseRecord = {
    hospitalId,
    hospitalName: hospital?.name,
    planId: plan?.id,
    planName: plan?.name,
    planType: plan?.type || "individual",
    fee: plan?.fee || 0,
    status: "Pending Approval",
    patientId: null,
    enrolledAt: new Date().toISOString(),
  };

  const ownerRecord = {
    ...baseRecord,
    id: ownerId,
    memberId,
    memberName,
    personal,
    medical,
    consent,
    isFamilyPlanOwner: plan?.type === "family" && includedMembers.length > 0,
  };

  // A non-dependent member (their own Sabi Health account, not a
  // managed profile) has to accept being added to someone else's plan
  // first — same request/accept pattern as adding them to a Family &
  // Care Circle. A dependent is fully managed by the owner, so they're
  // added straight into the normal hospital-approval flow.
  const linkedRecords = plan?.type === "family"
    ? includedMembers.map((m, i) => ({
        ...baseRecord,
        id: `${ownerId}-fam-${i}`,
        memberId: m.id,
        memberName: m.name,
        familyPlanOwnerId: ownerId,
        status: m.isDependent === false ? "Awaiting Member Acceptance" : "Pending Approval",
      }))
    : [];

  const coveredIds = new Set([memberId, ...includedMembers.map((m) => m.id)]);
  const next = [
    ownerRecord,
    ...linkedRecords,
    ...getStored().filter((e) => !(coveredIds.has(e.memberId) && e.hospitalId === hospitalId)),
  ];
  persist(next);

  // No fabricated hospital-side approval or member acceptance here: every
  // record above stays at "Pending Approval" / "Awaiting Member Acceptance"
  // until a real hospital-facing backend actually reviews it (BACKEND REQUIRED).

  return ownerRecord;
}

export function removeEnrollment(id) {
  const next = getStored().filter((e) => e.id !== id && e.familyPlanOwnerId !== id);
  persist(next);
  return next;
}

// ---------------- Digital check-in ----------------

const CHECKIN_KEY = "sabi-hospital-checkins";

function getCheckins() {
  try {
    const raw = window.localStorage.getItem(CHECKIN_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return {};
}

function persistCheckins(data) {
  try {
    window.localStorage.setItem(CHECKIN_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
  return data;
}

export function getCheckIn(appointmentId) {
  return getCheckins()[appointmentId] || null;
}

export function checkIn(appointmentId) {
  const data = getCheckins();
  // Queue position and wait time are real hospital-queue facts this frontend has no way to
  // know without a connected backend — null here, never a generated placeholder number.
  const record = {
    appointmentId,
    checkedInAt: new Date().toISOString(),
    queueNumber: null,
    estimatedWaitMinutes: null,
  };
  persistCheckins({ ...data, [appointmentId]: record });
  return record;
}
