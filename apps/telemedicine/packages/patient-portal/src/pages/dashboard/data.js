import { colors } from "design-system";
import {
  LayoutDashboard,
  FileText,
  HeartPulse,
  Stethoscope,
  Calendar,
  Building2,
  ClipboardList,
  TestTube,
  Syringe,
  FileBadge2 as InsuranceIcon,
  Pill,
  Users,
  ShieldAlert,
  CalendarPlus,
  Store,
  ReceiptText,
  Truck,
  UploadCloud,
  Zap,
  Droplet,
  Activity as ActivityIcon,
  HeartHandshake,
  Settings,
  LogOut,
} from "lucide-react";

// Placeholder content for the patient dashboard.
// Swap these for real API data when wiring the page up.
// `icon` holds the lucide-react component itself (not a rendered
// element) — consumers render it as <item.icon size={18} />.
export const NAV_ITEMS = [

  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { key: "records", label: "Medical Records", icon: FileText, to: "/records" },
  { key: "vitals", label: "Vital History", icon: HeartPulse, to: "/vitals" },
  { key: "doctors", label: "Doctors", icon: Stethoscope, to: "/doctor" },
  { key: "wellness-hub", label: "Wellness Hub", icon: HeartHandshake, to: "/wellness-hub" },
  
  { key: "appointments", label: "Appointments", icon: Calendar, to: "/appointments" },
  { key: "hospitals", label: "Hospitals", icon: Building2, to: "/hospitals" },
  { key: "prescriptions", label: "Prescriptions", icon: ClipboardList,  to: "/prescriptions", },
  { key: "pharmacy-market", label: "Pharmacy Market", icon: Store, to: "/pharmacy-market" },
  { key: "pharmacy-quotes", label: "Pharmacy Quotes", icon: ReceiptText, to: "/pharmacy-quotes" },
  { key: "delivery-tracking", label: "Delivery Tracking", icon: Truck, to: "/delivery-tracking" },
  // { key: "lab", label: "Lab Results", icon: TestTube },
  // { key: "vaccinations", label: "Vaccinations", icon: Syringe },
  { key: "insurance", label: "Insurance", icon: InsuranceIcon, to: "/insurance" },
  // { key: "medications", label: "Medications", icon: Pill },
  {key: "family",label: "Family", icon: Users,to: "/family",},
  // { key: "emergency", label: "Emergency ID", icon: ShieldAlert },
];

export const FOOTER_ITEMS = [
  { key: "settings", label: "Settings", icon: Settings, to: "/profile" },
  { key: "logout", label: "Logout", icon: LogOut, danger: true },
];
export const QUICK_ACTIONS = [
  { title: "Book Appointment", subtitle: "Schedule with your doctor", icon: CalendarPlus, to: "/appointments" },
  { title: "Upload Record", subtitle: "Add new lab results", icon: UploadCloud, to: "/records" },
  { title: "Emergency access", subtitle: "Access rapid doctors", icon: Zap, action: "emergency" },
];

// `activeSub` only renders for the item currently marked active in
// TodaysSchedule (the first one) — mirrors the "Connect in 15m" line.
export const SCHEDULE = [
  { time: "09:00 AM", title: "Video Call: Dr. Jenkins", activeSub: "Connect in 15m" },
  { time: "02:30 PM", title: "Physical Therapy Session" },
];

export const CONSULTATIONS = [
  { id: "blood-panel-oct24", title: "Annual Comprehensive Blood Panel", sub: "Dr. Sarah Jenkins · Oct 24, 2023", icon: Droplet },
  { id: "ecg-sep12-1", title: "Resting ECG Report", sub: "Metropolitan Heart Center · Sep 12, 2023", icon: ActivityIcon },
  { id: "ecg-sep12-2", title: "Resting ECG Report", sub: "Metropolitan Heart Center · Sep 12, 2023", icon: ActivityIcon },
  { id: "ecg-sep12-3", title: "Resting ECG Report", sub: "Metropolitan Heart Center · Sep 12, 2023", icon: ActivityIcon },
  { id: "ecg-sep12-4", title: "Resting ECG Report", sub: "Metropolitan Heart Center · Sep 12, 2023", icon: ActivityIcon },
  { id: "ecg-sep12-5", title: "Resting ECG Report", sub: "Metropolitan Heart Center · Sep 12, 2023", icon: ActivityIcon },
];

export const MEDICATIONS = [
  { name: "Lisinopril 10mg", sub: "After Breakfast", state: "take" },
  { name: "Vitamin D3", sub: "08:00 AM · Taken", state: "taken" },
];

export const FAMILY = [
  { initials: "JD", bg: colors.primary, online: true },
  { initials: "AA", bg: colors.warning, online: true },
];


// The Emergency Card (opened from the red topbar button), built from the patient's saved profile.
// Details the profile doesn't hold yet show as "Not recorded" rather than sample values.
const NOT_RECORDED = "Not recorded";
const splitList = (value) => (value ? value.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : []);

export function toEmergencyProfile(profile) {
  const form = profile?.form || {};
  const name = form.fullName || "Patient";
  const birth = form.dob ? new Date(`${form.dob}T00:00:00Z`) : null;
  const age = birth ? Math.floor((Date.now() - birth.getTime()) / 31557600000) : "—";
  const contact = form.contactName
    ? { name: `${form.contactName}${form.contactRelation ? ` (${form.contactRelation})` : ""}`, phone: form.contactPhone || "—" }
    : { name: NOT_RECORDED, phone: "—" };
  return {
    name,
    initials: name.split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
    dob: birth ? birth.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : NOT_RECORDED,
    age,
    bloodGroup: form.bloodType || NOT_RECORDED,
    genotype: form.genotype || NOT_RECORDED,
    emergencyContact: contact,
    conditions: splitList(form.chronicConditions),
    allergies: { drugs: splitList(form.knownAllergies), foods: [], others: [] },
    medications: splitList(form.currentMedications),
    contacts: { primary: contact, secondary: { name: NOT_RECORDED, phone: "—" } },
    provider: { name: NOT_RECORDED, phone: "—" },
    insurance: { provider: NOT_RECORDED, policyNumber: "—" },
  };
}
