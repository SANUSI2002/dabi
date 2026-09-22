import {
  Folder,
  Hospital,
  Stethoscope,
  FileEdit,
  FlaskConical,
  ScanLine,
  Syringe,
  CloudUpload,
  Link2,
  Mail,
} from "lucide-react";

// Placeholder content for the Medical Records page.
// Swap these for real API data when wiring the page up.
// `icon` holds the lucide-react component itself, rendered by
// consumers as <Icon size={..} />.

export const VITAL_INFO = {
  bloodGroup: "O Positive",
  genotype: "AA",
  allergies: ["Penicillin", "Peanuts"],
  chronicCondition: "Asthma (Controlled)",
};

// Most recent first. `isTimelineEntry` records render as full clinical
// cards in the Records timeline; every record (timeline or not) can
// also carry a `categoryId` so it shows up filed under a category in
// Organized Records — or `categoryId: null` to sit in the unfiled pool
// that "Add existing record" pulls from.
export const INITIAL_RECORDS = [
  {
    id: "rec-chest-xray",
    isTimelineEntry: true,
    date: "Oct 14, 2023",
    title: "Chest Xray Examination",
    meta: "Virtual · Dr. Elena Richards",
    diagnosis: "Hyperlipidemia (Mild), Vitamin D Deficiency.",
    treatment: "Dietary adjustments, daily supplement of 2000IU Vitamin D3.",
    tag: "General Practice",
    tagIcon: Hospital,
    categoryId: "consultations",
  },
  {
    id: "rec-lth-consultation",
    isTimelineEntry: true,
    date: "Sep 30, 2023",
    title: "Hospital Consultation",
    meta: "Physical · Lagos Teaching Hospital · Dr. Adaeze Nwosu",
    diagnosis: "Routine hypertension follow-up booked through Sabi Health; blood pressure within target range.",
    treatment: "Continue Amlodipine 5mg daily, repeat lipid panel in 3 months.",
    tag: "Hospital Consultation",
    tagIcon: Hospital,
    categoryId: "consultations",
  },
  {
    id: "rec-sinusitis",
    isTimelineEntry: true,
    date: "Aug 22, 2023",
    title: "Acute Sinusitis Consultation",
    meta: "Physical · Dr. Marcus Thorne",
    diagnosis: "Acute bacterial sinusitis secondary to allergic rhinitis.",
    treatment: "Amoxicillin-clavulanate (875mg), nasal corticosteroid spray.",
    tag: "General Practice",
    tagIcon: Hospital,
    categoryId: "consultations",
  },
  // Sample "unfiled" documents — not yet sorted into a category, so
  // they show up in every category's "Add existing record" picker.
  {
    id: "rec-malaria-test",
    isTimelineEntry: false,
    date: "Jul 02, 2026",
    title: "Malaria Rapid Test",
    notes: "Negative result, self-requested at a Lagos pharmacy.",
    categoryId: null,
  },
  {
    id: "rec-dental-xray",
    isTimelineEntry: false,
    date: "Mar 14, 2024",
    title: "Dental X-Ray",
    notes: "Routine checkup, no cavities found.",
    categoryId: null,
  },
];

export const RECENT_ACTIVITY = [
  {
    icon: CloudUpload,
    title: "Lab results uploaded",
    sub: "Metabolic Panel from Quest Diagnostics",
    time: "2 hours ago",
  },
  {
    icon: Link2,
    title: "Permission Granted",
    sub: "Dr. Sarah Miller can view Radiology records",
    time: "Yesterday",
  },
  {
    icon: Mail,
    title: "Shared via Secure Email",
    sub: "Vaccination History sent to School Board",
    time: "Oct 12, 2023",
  },
];

// The categories a patient sees by default ("primary" ones). They can add
// more via "Add Category" — new ones aren't marked primary. Clicking any
// category opens it so records can be filed directly into it.
export const DEFAULT_CATEGORIES = [
  { id: "consultations", label: "Consultations", icon: Stethoscope, unit: "Documents", baseCount: 25, primary: true },
  {
    id: "prescriptions",
    label: "Prescriptions",
    icon: FileEdit,
    unit: "Documents",
    baseCount: 57,
    countLabel: "12 Active, 45 Past",
    primary: true,
  },
  { id: "lab-results", label: "Lab Results", icon: FlaskConical, unit: "Reports", baseCount: 15, primary: true },
  {
    id: "medical-imaging",
    label: "Medical Imaging",
    icon: ScanLine,
    unit: "Scans / X-Rays",
    baseCount: 8,
    primary: true,
  },
  {
    id: "vaccinations",
    label: "Vaccinations",
    icon: Syringe,
    unit: "Records",
    baseCount: 0,
    countLabel: "Fully Immunized",
    primary: true,
  },
];

export const CATEGORY_ICON_CHOICES = [Folder, Stethoscope, FlaskConical, ScanLine, Syringe, FileEdit, Hospital];
