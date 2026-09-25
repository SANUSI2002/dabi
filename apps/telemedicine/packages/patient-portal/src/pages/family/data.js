import { Star, Users2, HeartHandshake, Eye, IdCard } from "lucide-react";

// ---------------- Permission levels (join + edit-access flows) ----------------
export const PERMISSION_LEVELS = [
  {
    id: "owner",
    label: "Owner",
    icon: Star,
    description: "Full access to your profile, dependents and all shared health data.",
  },
  {
    id: "care-manager",
    label: "Care Manager",
    icon: Users2,
    description: "Can see your records, appointments, medications and vitals, and help manage dependents.",
  },
  {
    id: "caregiver",
    label: "Caregiver",
    icon: HeartHandshake,
    description: "Can follow appointments, medications and vitals, and see your emergency summary.",
  },
  {
    id: "viewer",
    label: "Viewer",
    icon: Eye,
    description: "Read-only access to vitals and your emergency summary.",
  },
];

export const EMERGENCY_ONLY_LEVEL = {
  id: "emergency-only",
  label: "Emergency Only",
  icon: IdCard,
  description: "No access to your data. Ideal for extended family or neighbours you want listed in your circle.",
};

export const ALL_LEVELS = [...PERMISSION_LEVELS, EMERGENCY_ONLY_LEVEL];
export const levelLabel = (id) => ALL_LEVELS.find((l) => l.id === id)?.label || "Member";

// ---------------- Granular access (the server's permission vocabulary) ----------------
export const ACCESS_KEYS = [
  { key: "PROFILE", label: "Profile & Dependents" },
  { key: "RECORDS", label: "Medical Records" },
  { key: "APPOINTMENTS", label: "Appointments" },
  { key: "MEDICATIONS", label: "Medications" },
  { key: "VITALS", label: "Vitals" },
  { key: "EMERGENCY_SUMMARY", label: "Emergency Summary" },
];
const ALL_ACCESS = ACCESS_KEYS.map((a) => a.key);

// Starting point for each level; the patient can still switch individual items on or off.
export const DEFAULT_ACCESS_BY_LEVEL = {
  owner: ALL_ACCESS,
  "care-manager": ALL_ACCESS,
  caregiver: ["APPOINTMENTS", "MEDICATIONS", "VITALS", "EMERGENCY_SUMMARY"],
  viewer: ["VITALS", "EMERGENCY_SUMMARY"],
  "emergency-only": [],
};

export const accessLabels = (permissions = []) =>
  ACCESS_KEYS.filter((a) => permissions.includes(a.key)).map((a) => a.label);

export const RELATIONSHIPS = [
  "Spouse", "Mother", "Father", "Son", "Daughter", "Sister", "Brother", "Grandparent", "Guardian", "Other",
];

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const GENOTYPES = ["AA", "AS", "SS", "AC", "SC", "CC"];
export const IMMUNIZATION_OPTIONS = ["Up to date", "Partially complete", "Not started"];
export const PEDIATRIC_MILESTONES = ["Smiling & Cooing", "Rolling Over", "Sitting Unassisted"];
export const MOBILITY_CHECKS = ["Independent Mobility", "Uses Walking Aid", "Fall Risk Assessment Done"];

export const AVATAR_COLORS = ["#2E6B5A", "#D97706", "#2563EB", "#7C3AED", "#DB2777", "#0D9488"];
export const colorFor = (id = "") => AVATAR_COLORS[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
