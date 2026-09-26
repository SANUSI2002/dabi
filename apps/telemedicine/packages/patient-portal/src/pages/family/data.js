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

// ---------------- Mapping to the Sabi API ----------------
// The access toggles above map onto the server's permission vocabulary. Messaging and Health
// Wallet have no server-side equivalent yet, so they're never shared.
const ACCESS_TO_SERVER = { medicalRecords: "RECORDS", labResults: "RECORDS", prescriptions: "MEDICATIONS", appointments: "APPOINTMENTS", vitals: "VITALS" };

export function toServerPermissions(access, level) {
  if (level === "emergency-only") return [];
  const permissions = new Set(Object.entries(ACCESS_TO_SERVER).filter(([key]) => access?.[key]).map(([, value]) => value));
  if (level === "owner" || level === "care-manager") permissions.add("PROFILE");
  permissions.add("EMERGENCY_SUMMARY");
  return [...permissions];
}

export function fromServerPermissions(permissions = []) {
  const has = (p) => permissions.includes(p);
  return {
    medicalRecords: has("RECORDS"),
    prescriptions: has("MEDICATIONS"),
    appointments: has("APPOINTMENTS"),
    vitals: has("VITALS"),
    labResults: has("RECORDS"),
    messaging: false,
    healthWallet: false,
  };
}

export const AVATAR_COLORS = ["#2E6B5A", "#D97706", "#2563EB", "#7C3AED", "#DB2777", "#0D9488"];
export const colorFor = (id = "") => AVATAR_COLORS[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
