// Frontend-only procedure lifecycle for minor/outpatient procedures performed at
// this primary health post (e.g. circumcision, wound debridement, incision &
// drainage, IUCD insertion/removal) — not a full surgical theatre system.

export type ProcedureStatus =
  | "Requested" | "Scheduled" | "Consented" | "Pre-procedure"
  | "Performed" | "Recovery" | "Follow-up" | "Cancelled";

export const PROCEDURE_STATUS_ORDER: ProcedureStatus[] = [
  "Requested", "Scheduled", "Consented", "Pre-procedure", "Performed", "Recovery", "Follow-up",
];

export type SafetyChecklistPhase = "Sign In" | "Time Out" | "Sign Out";

export type SafetyChecklistItem = {
  id: string;
  phase: SafetyChecklistPhase;
  label: string;
  completed: boolean;
  exceptionReason?: string;
};

export type ProcedureNoteAmendment = { by: string; at: string; note: string };

export type ProcedureRecord = {
  id: string;
  patientId: string;
  name: string;
  indication: string;
  bodySite?: string;
  laterality?: "Left" | "Right" | "Bilateral" | "N/A";
  priority: "Routine" | "Urgent" | "Emergency";
  status: ProcedureStatus;
  requestedBy: string;
  requestedAt: string;
  scheduledFor?: string;
  performer?: string;
  assistants?: string[];
  anaesthesia?: string;
  consentObtainedBy?: string;
  consentAt?: string;
  checklist: SafetyChecklistItem[];
  performedAt?: string;
  device?: string;
  complications?: string;
  outcome?: string;
  findings?: string;
  specimenSentToLab?: boolean;
  recoveryNotes?: string;
  followUpPlan?: string;
  noteSigned?: boolean;
  noteSignedBy?: string;
  noteSignedAt?: string;
  amendments?: ProcedureNoteAmendment[];
  cancelledReason?: string;
};

const rid = () => Math.random().toString(36).slice(2, 9);

export function defaultChecklist(): SafetyChecklistItem[] {
  const items: { phase: SafetyChecklistPhase; label: string }[] = [
    { phase: "Sign In", label: "Patient identity, site and procedure confirmed" },
    { phase: "Sign In", label: "Consent confirmed" },
    { phase: "Sign In", label: "Site marked (if applicable)" },
    { phase: "Sign In", label: "Known allergies reviewed" },
    { phase: "Time Out", label: "Team introduced; procedure and site confirmed aloud" },
    { phase: "Time Out", label: "Equipment and instruments confirmed available" },
    { phase: "Time Out", label: "Antibiotic prophylaxis given (or not indicated)" },
    { phase: "Sign Out", label: "Instrument, sponge and needle counts correct" },
    { phase: "Sign Out", label: "Specimen labelled (if applicable)" },
    { phase: "Sign Out", label: "Key concerns for recovery communicated" },
  ];
  return items.map((item) => ({ id: `chk-${rid()}`, ...item, completed: false }));
}

const daysAgo = (n: number, h = 9) => {
  const date = new Date();
  date.setDate(date.getDate() - n);
  date.setHours(h, 0, 0, 0);
  return date.toISOString();
};

export const seedProcedures: ProcedureRecord[] = [
  {
    id: "proc-1", patientId: "p3", name: "Incision and drainage — abscess",
    indication: "Fluctuant left thigh abscess, 4cm, failed conservative management",
    bodySite: "Left thigh", laterality: "Left", priority: "Urgent",
    status: "Follow-up",
    requestedBy: "Dr. Adaeze Okonjo", requestedAt: daysAgo(6),
    scheduledFor: daysAgo(5), performer: "Dr. Adaeze Okonjo", assistants: ["Nurse Grace Nwangbo"],
    anaesthesia: "Local (lidocaine 1%)",
    consentObtainedBy: "Dr. Adaeze Okonjo", consentAt: daysAgo(5),
    checklist: defaultChecklist().map((item) => ({ ...item, completed: true })),
    performedAt: daysAgo(5), device: "Scalpel, blade 11",
    complications: "None", outcome: "Adequate drainage, ~15mL purulent material",
    findings: "No foreign body; wound packed with ribbon gauze",
    specimenSentToLab: true,
    recoveryNotes: "Stable post-procedure, no bleeding, tolerated analgesia",
    followUpPlan: "Wound dressing change in 48h; review in 5 days",
    noteSigned: true, noteSignedBy: "Dr. Adaeze Okonjo", noteSignedAt: daysAgo(5),
  },
  {
    id: "proc-2", patientId: "p13", name: "IUCD insertion",
    indication: "Postpartum family planning, patient request",
    bodySite: "Uterus", laterality: "N/A", priority: "Routine",
    status: "Requested",
    requestedBy: "Nurse Grace Nwangbo", requestedAt: daysAgo(1),
    checklist: defaultChecklist(),
  },
];
