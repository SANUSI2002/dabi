import {
  Star,
  Users2,
  HeartHandshake,
  Eye,
  IdCard,
} from "lucide-react";

// ---------------- Permission levels (join + edit-access flows) ----------------
export const PERMISSION_LEVELS = [
  {
    id: "owner",
    label: "Owner",
    icon: Star,
    description: "Full control over circle members, billing, and all health data settings.",
  },
  {
    id: "care-manager",
    label: "Care Manager",
    icon: Users2,
    description: "Can edit records, manage appointments, and view full health history.",
  },
  {
    id: "caregiver",
    label: "Caregiver",
    icon: HeartHandshake,
    description: "Can log vitals, view upcoming care plans, and communicate with doctors.",
  },
  {
    id: "viewer",
    label: "Viewer",
    icon: Eye,
    description: "Read-only access to basic health trends and circle updates.",
  },
];

export const EMERGENCY_ONLY_LEVEL = {
  id: "emergency-only",
  label: "Emergency Only",
  icon: IdCard,
  description: "No access until an Emergency state is triggered. Ideal for extended family or neighbors.",
};

// ---------------- Granular access toggles ----------------
export const ACCESS_KEYS = [
  { key: "medicalRecords", label: "Medical Records" },
  { key: "prescriptions", label: "Prescriptions" },
  { key: "appointments", label: "Appointments" },
  { key: "vitals", label: "Vitals" },
  { key: "labResults", label: "Laboratory Results" },
  { key: "messaging", label: "Messaging" },
  { key: "healthWallet", label: "Health Wallet" },
];

export const DEFAULT_ACCESS_BY_LEVEL = {
  owner: { medicalRecords: true, prescriptions: true, appointments: true, vitals: true, labResults: true, messaging: true, healthWallet: true },
  "care-manager": { medicalRecords: true, prescriptions: true, appointments: true, vitals: true, labResults: false, messaging: true, healthWallet: false },
  caregiver: { medicalRecords: false, prescriptions: false, appointments: true, vitals: true, labResults: false, messaging: true, healthWallet: false },
  viewer: { medicalRecords: false, prescriptions: false, appointments: false, vitals: true, labResults: false, messaging: false, healthWallet: false },
  "emergency-only": { medicalRecords: false, prescriptions: false, appointments: false, vitals: false, labResults: false, messaging: false, healthWallet: false },
};

export const RELATIONSHIPS = [
  "Spouse", "Mother", "Father", "Son", "Daughter", "Sister", "Brother", "Grandparent", "Guardian", "Other",
];

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
export const GENOTYPES = ["AA", "AS", "SS", "AC", "SC"];

// A circle someone might be invited to join (Join a Family Circle flow).
// Real invite codes/QR payloads would resolve via the backend; this is
// the demo lookup table.
export const INVITE_CIRCLE = {
  id: "okafor-family",
  name: "Okafor Family Circle",
  ownerName: "Chidinma Okafor",
  memberCount: 4,
};

export const INVITE_CODES = [
  { code: "OKAFOR-7721", circle: INVITE_CIRCLE },
  {
    code: "ADEYEMI-3390",
    circle: { id: "adeyemi-family", name: "Adeyemi Family Circle", ownerName: "Sarah Adeyemi", memberCount: 6 },
  },
];

export function findCircleByCode(code) {
  const normalized = (code || "").trim().toUpperCase();
  return INVITE_CODES.find((c) => c.code === normalized)?.circle || null;
}

// ---------------- Seed members for the signed-in user's own circle ----------------
export const SEED_MEMBERS = [
  {
    id: "self",
    name: "You (John Doe)",
    initials: "JD",
    color: "#2E6B5A",
    relationship: "Self",
    isSelf: true,
    isDependent: false,
    age: 34,
    score: 91,
    status: "Stable",
    nextAppointment: "Not scheduled",
    activeMedications: 1,
    dueVaccinations: 0,
    lastDose: "This morning",
    permission: "owner",
    access: DEFAULT_ACCESS_BY_LEVEL.owner,
    bloodGroup: "O+",
    genotype: "AA",
    allergies: ["Penicillin"],
    sabiHealthId: "SABI-001-772-A",
  },
  {
    id: "martha",
    name: "Martha Johnson",
    initials: "MJ",
    color: "#D97706",
    relationship: "Mother",
    isDependent: false,
    age: 68,
    score: 84,
    status: "Monitoring",
    nextAppointment: "Nov 12, 10:00 AM · Cardiology",
    activeMedications: 3,
    dueVaccinations: 0,
    lastDose: "2h ago",
    permission: "care-manager",
    access: DEFAULT_ACCESS_BY_LEVEL["care-manager"],
    bloodGroup: "A+",
    genotype: "AS",
    allergies: ["Sulfa drugs"],
    sabiHealthId: "SABI-882-104-M",
  },
  {
    id: "leo",
    name: "Leo Johnson",
    initials: "LJ",
    color: "#2563EB",
    relationship: "Son",
    isDependent: true,
    age: 8,
    score: 96,
    status: "Stable",
    nextAppointment: "Dec 01, 2:30 PM · Flu Vaccination",
    activeMedications: 0,
    dueVaccinations: 1,
    lastDose: "—",
    permission: "care-manager",
    access: DEFAULT_ACCESS_BY_LEVEL["care-manager"],
    bloodGroup: "O+",
    genotype: "AA",
    allergies: [],
    sabiHealthId: "SABI-882-941-X",
  },
  {
    id: "father",
    name: "Michael Doe",
    initials: "MD",
    color: "#7C3AED",
    relationship: "Father",
    isDependent: false,
    age: 71,
    score: 62,
    status: "Needs Attention",
    nextAppointment: "Not scheduled",
    activeMedications: 4,
    dueVaccinations: 0,
    lastDose: "Missed · this morning",
    permission: "caregiver",
    access: DEFAULT_ACCESS_BY_LEVEL.caregiver,
    bloodGroup: "B+",
    genotype: "AA",
    allergies: ["Aspirin"],
    sabiHealthId: "SABI-441-208-F",
  },
  {
    id: "ada",
    name: "Ada Doe",
    initials: "AD",
    color: "#DB2777",
    relationship: "Daughter",
    isDependent: true,
    age: 3,
    score: 98,
    status: "Stable",
    nextAppointment: "Jan 14, 9:00 AM · Pediatric Checkup",
    activeMedications: 0,
    dueVaccinations: 2,
    lastDose: "—",
    permission: "care-manager",
    access: DEFAULT_ACCESS_BY_LEVEL["care-manager"],
    bloodGroup: "O+",
    genotype: "AS",
    allergies: ["Peanuts"],
    sabiHealthId: "SABI-119-663-D",
  },
  {
    id: "grace",
    name: "Grace Doe",
    initials: "GD",
    color: "#0D9488",
    relationship: "Sister",
    isDependent: false,
    age: 29,
    score: 90,
    status: "Stable",
    nextAppointment: "Not scheduled",
    activeMedications: 0,
    dueVaccinations: 0,
    lastDose: "—",
    permission: "emergency-only",
    access: DEFAULT_ACCESS_BY_LEVEL["emergency-only"],
    bloodGroup: "A-",
    genotype: "AA",
    allergies: [],
    sabiHealthId: "SABI-660-337-G",
  },
];

export const CARE_ALERTS = [
  { id: "alert-1", kind: "refill", text: "Martha's prescription for Lisinopril expires tomorrow.", cta: "Refill Now" },
  { id: "alert-2", kind: "missed", text: "Michael missed 2 doses of Morning Meds. Notify caregiver?", cta: "Notify" },
];

export const ACTIVITY_TIMELINE = [
  { id: "act-1", text: "You completed BP meds", meta: "15 mins ago · Automatic Sync" },
  { id: "act-2", text: "Martha attended cardiology appt", meta: "2 hours ago · City General Hospital" },
  { id: "act-3", text: "Leo's teacher updated vitals", meta: "4 hours ago · Daily Wellness Check" },
];
