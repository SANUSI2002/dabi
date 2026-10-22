import { create } from "zustand";
import { persisted } from "./persist";
import { audit } from "@/store/useAudit";
import type { ProductKey } from "./entitlements";

// Centralised master-data registry (Phase 7).
// Every configurable dropdown in the platform is a category here. Consumers call
// `activeItems(category)` for options and `label(category, id)` to resolve.
// Administrators manage all of them from one Settings screen.

export type MasterItem = {
  id: string;
  label: string;
  code?: string;
  active: boolean;
  system?: boolean; // seeded, cannot be deleted (may be deactivated)
  meta?: Record<string, string | number | boolean>;
};

export type MasterCategoryDef = {
  key: string;
  label: string;
  product?: ProductKey | "platform";
  description: string;
  /** permissions (besides the product's own) that may edit this list, e.g. the pharmacy for drug lists */
  editors?: string[];
  /** extra columns the admin can set, beyond label/code */
  fields?: { key: string; label: string; type: "text" | "number" | "checkbox" }[];
};

export const MASTER_CATEGORIES: MasterCategoryDef[] = [
  { key: "leave-types", label: "Leave Types", product: "workforce", description: "Categories of leave employees can request" },
  { key: "employment-types", label: "Employment Types", product: "workforce", description: "Full-time, contract, locum, etc." },
  { key: "document-types", label: "Employee Document Types", product: "workforce", description: "Categories for the employee document library", fields: [{ key: "expires", label: "Has expiry", type: "checkbox" }, { key: "mandatory", label: "Required at onboarding", type: "checkbox" }] },
  { key: "certification-types", label: "Certification / Licence Types", product: "workforce", description: "Professional bodies and licence classes", fields: [{ key: "renewalMonths", label: "Renewal cycle (months)", type: "number" }] },
  { key: "query-types", label: "Disciplinary Query Types", product: "workforce", description: "Reasons a query can be raised" },
  { key: "recruitment-statuses", label: "Recruitment Statuses", product: "workforce", description: "Stages an applicant moves through", fields: [{ key: "terminal", label: "Ends the pipeline", type: "checkbox" }] },
  { key: "vacancy-types", label: "Vacancy Types", product: "workforce", description: "New role, replacement, temporary cover, etc." },
  { key: "handover-item-types", label: "Handover Item Types", product: "workforce", description: "What a role handover checklist can contain" },
  { key: "loan-types", label: "Loan Types", product: "workforce", description: "Named loan products with default terms", fields: [{ key: "maxMonths", label: "Max term (months)", type: "number" }, { key: "autoDebit", label: "Salary auto-debit", type: "checkbox" }] },
  { key: "policy-categories", label: "Policy Categories", product: "workforce", description: "How HR policies are grouped" },
  { key: "helpdesk-ticket-types", label: "Helpdesk Ticket Types", product: "workforce", description: "What staff raise helpdesk tickets about" },
  { key: "recruitment-sources", label: "Recruitment Sources", product: "workforce", description: "Where a candidate came from; 'Inside software' is recorded for candidates taken from the talent pool" },
  { key: "candidate-rejection-reasons", label: "Candidate Rejection Reasons", product: "workforce", description: "Why a candidate is not taken forward" },
  { key: "talent-skill-zones", label: "Talent Pool Skill Zones", product: "workforce", description: "How the talent pool is grouped" },
  { key: "exit-reasons", label: "Exit Reasons", product: "workforce", description: "Why an employee leaves" },
  { key: "id-types", label: "Identification Types", product: "platform", description: "NIN, passport, driver's licence, voter card" },
  { key: "ward-types", label: "Ward Types", product: "emr", description: "General, maternity, paediatric, ICU, isolation" },
  { key: "bed-types", label: "Bed Types", product: "emr", description: "Standard, VIP, cot, incubator, recovery" },
  { key: "lab-sample-types", label: "Lab Sample Types", product: "emr", description: "Blood, urine, stool, swab, CSF, tissue" },
  { key: "lab-stage-types", label: "Lab Stage Types", product: "emr", description: "Named processing stages tests can be composed from" },
  { key: "drug-categories", label: "Drug Categories", product: "emr", description: "Therapeutic groups the formulary is filed under and prescribers search by — managed by the pharmacy", editors: ["emr.formulary.manage", "catalog.manage"], fields: [{ key: "emdexClasses", label: "EMDEX class names (comma-separated)", type: "text" }] },
  { key: "drug-classes", label: "Drug Classes", product: "emr", description: "Pharmacological classes behind the allergy and duplicate-therapy checks — managed by the pharmacy", editors: ["emr.formulary.manage", "catalog.manage"] },
  { key: "appointment-types", label: "Appointment Types", product: "emr", description: "What an appointment is for; a type the hospital adds checks in at the general vitals station", editors: ["appointment.manage"] },
  { key: "patient-languages", label: "Patient Languages", product: "emr", description: "Preferred languages recorded at registration" },
  { key: "transfer-reasons", label: "Transfer Reasons", product: "emr", description: "Why care moves to or from another facility" },
  { key: "fp-discontinue-reasons", label: "Family Planning \u2014 Reasons for Stopping", product: "emr", description: "Why a family planning client stops a method" },
  { key: "store-item-categories", label: "Store Item Categories", product: "emr", description: "How hospital store items are grouped; Drugs post to the drug inventory and cost-of-drugs accounts, the rest to supplies", editors: ["stores.manage"] },
  { key: "equipment-categories", label: "Equipment Categories", product: "emr", description: "How equipment assets are grouped", editors: ["equipment.manage"] },
  { key: "prescription-rejection-reasons", label: "Prescription Rejection Reasons", product: "emr", description: "Why the pharmacy returns a prescription to the prescriber", editors: ["emr.formulary.manage"] },
  { key: "specimen-rejection-reasons", label: "Specimen Rejection Reasons", product: "emr", description: "Why the laboratory rejects a specimen", editors: ["lab.catalog.manage"] },
  { key: "ncd-conditions", label: "NCD Conditions", product: "emr", description: "Long-term conditions the NCD clinic enrols patients for; the starter ones are counted in NCD reports", editors: ["ncd.enrol"] },
  { key: "outreach-activity-types", label: "Outreach Activity Types", product: "emr", description: "What community health workers record doing in the community", editors: ["outreach.record"] },
  { key: "receiving-accounts", label: "Receiving Accounts", product: "emr", description: "Where a patient payment was received, recorded with the payment", editors: ["billing.payment.record"] },
  { key: "inpatient-services", label: "Inpatient Services", product: "emr", description: "The service (specialty) a patient is admitted under; shown on the ward census and handover" },
  { key: "expense-categories", label: "Expense Categories", product: "accounting", description: "Categories for staff expense claims" },
];

const seedItems: Record<string, Omit<MasterItem, "id">[]> = {
  "policy-categories": [
    { label: "Conduct", active: true },
    { label: "Safety & Clinical", active: true },
    { label: "Data & Security", active: true },
    { label: "IT & Assets", active: true },
    { label: "Leave & Attendance", active: true },
    { label: "Other", active: true, system: true },
  ],
  "helpdesk-ticket-types": [
    { label: "IT Support", active: true },
    { label: "HR Complaint", active: true },
    { label: "Facilities", active: true },
    { label: "Benefits", active: true },
    { label: "General", active: true, system: true },
  ],
  "recruitment-sources": [
    { label: "Application", active: true },
    { label: "Referral", active: true },
    { label: "Inside software", active: true, system: true },
  ],
  "candidate-rejection-reasons": [
    { label: "Overqualified", active: true },
    { label: "Underqualified", active: true },
    { label: "Failed practical test", active: true },
    { label: "Salary mismatch", active: true },
    { label: "Did not attend interview", active: true },
    { label: "Position filled internally", active: true },
    { label: "Other", active: true, system: true },
  ],
  "talent-skill-zones": [
    { label: "Clinical \u2014 Nursing", active: true },
    { label: "Clinical \u2014 Medical", active: true },
    { label: "Laboratory", active: true },
    { label: "Records & HMIS", active: true },
    { label: "Administration", active: true },
    { label: "Community Health", active: true },
  ],
  "exit-reasons": [
    { label: "Resignation \u2014 better opportunity", active: true },
    { label: "Resignation \u2014 relocation", active: true },
    { label: "Resignation \u2014 personal reasons", active: true },
    { label: "End of contract", active: true },
    { label: "Termination \u2014 performance", active: true },
    { label: "Termination \u2014 conduct", active: true },
    { label: "Retirement", active: true },
  ],
  "inpatient-services": [
    { label: "General Medicine", active: true },
    { label: "Paediatrics", active: true },
    { label: "Obstetrics", active: true },
    { label: "Surgery", active: true },
    { label: "Isolation", active: true },
    { label: "Observation", active: true },
  ],
  "ncd-conditions": [
    { label: "Essential hypertension", active: true, system: true },
    { label: "Type 2 Diabetes Mellitus", active: true, system: true },
    { label: "Hypertension + Diabetes", active: true, system: true },
    { label: "Asthma", active: true, system: true },
    { label: "Sickle Cell Disease", active: true, system: true },
  ],
  "outreach-activity-types": [
    { label: "Household visit", active: true },
    { label: "Health talk", active: true },
    { label: "Immunization campaign", active: true },
    { label: "Defaulter tracing", active: true },
    { label: "Community screening", active: true },
  ],
  "receiving-accounts": [
    { label: "Main cash account", active: true },
    { label: "POS clearing account", active: true },
    { label: "Primary bank account", active: true },
    { label: "Mobile money clearing", active: true },
  ],
  "appointment-types": [
    { label: "General", code: "GENERAL", active: true, system: true },
    { label: "ANC", active: true, system: true },
    { label: "PNC", active: true, system: true },
    { label: "Follow-up", code: "FOLLOW_UP", active: true, system: true },
    { label: "Immunization", code: "IMMUNIZATION", active: true, system: true },
    { label: "Specialist", code: "SPECIALIST", active: true, system: true },
  ],
  "patient-languages": [
    { label: "English", active: true, system: true },
    { label: "Yoruba", active: true },
    { label: "Igbo", active: true },
    { label: "Hausa", active: true },
    { label: "Pidgin", active: true },
    { label: "French", active: true },
    { label: "Other", active: true },
  ],
  "transfer-reasons": [
    { label: "Relocation", active: true },
    { label: "Catchment reassignment", active: true },
    { label: "Service not available here", active: true },
    { label: "Patient request", active: true },
    { label: "Higher level of care", active: true },
  ],
  "fp-discontinue-reasons": [
    { label: "Wants to conceive", active: true },
    { label: "Side effects", active: true },
    { label: "Method failure", active: true },
    { label: "Moved away", active: true },
    { label: "Partner objection", active: true },
    { label: "Switched method", active: true },
    { label: "Removal", active: true, system: true },
  ],
  "store-item-categories": [
    { label: "Drugs", active: true, system: true },
    { label: "Consumables", active: true },
    { label: "Reagents", active: true },
    { label: "PPE", active: true },
    { label: "Surgical Supplies", active: true },
    { label: "Linen", active: true },
    { label: "Medical Devices", active: true },
    { label: "Other", active: true },
  ],
  "equipment-categories": [
    { label: "Cold chain", active: true },
    { label: "Maternity", active: true },
    { label: "Diagnostics", active: true },
    { label: "Power", active: true },
    { label: "IT", active: true },
    { label: "General", active: true, system: true },
  ],
  "prescription-rejection-reasons": [
    { label: "Invalid prescription", active: true },
    { label: "Expired prescription", active: true },
    { label: "Drug unavailable", active: true },
    { label: "Quantity unavailable", active: true },
    { label: "Prescription unclear", active: true },
    { label: "Incorrect patient", active: true },
    { label: "Duplicate prescription", active: true },
    { label: "Clinical concern", active: true },
    { label: "Prescription does not meet hospital policy", active: true },
    { label: "Other", active: true, system: true },
  ],
  "specimen-rejection-reasons": [
    { label: "Haemolysed sample", active: true },
    { label: "Insufficient volume", active: true },
    { label: "Clotted sample", active: true },
    { label: "Wrong container", active: true },
    { label: "Unlabelled / mislabelled", active: true },
    { label: "Leaked in transit", active: true },
    { label: "Expired collection", active: true },
    { label: "Other", active: true, system: true },
  ],
  "drug-categories": [
    { label: "Analgesics & Antipyretics", code: "ANALGESIC", active: true },
    { label: "Opioid Analgesics", code: "OPIOID", active: true },
    { label: "Antibiotics", code: "ANTIBIOTIC", active: true },
    { label: "Antimalarials", code: "ANTIMALARIAL", active: true },
    { label: "Antiprotozoals", code: "ANTIPROTOZOAL", active: true },
    { label: "Antifungals", code: "ANTIFUNGAL", active: true },
    { label: "Antivirals & Antiretrovirals", code: "ANTIVIRAL", active: true },
    { label: "Anthelmintics", code: "ANTHELMINTIC", active: true },
    { label: "Antihypertensives", code: "ANTIHYPERTENSIVE", active: true },
    { label: "Other Cardiovascular", code: "CARDIOVASCULAR", active: true },
    { label: "Antidiabetics", code: "ANTIDIABETIC", active: true },
    { label: "Anticoagulants & Antiplatelets", code: "ANTICOAGULANT", active: true },
    { label: "Respiratory (bronchodilators, cough)", code: "RESPIRATORY", active: true },
    { label: "Antihistamines & Anti-allergy", code: "ANTIHISTAMINE", active: true },
    { label: "Gastrointestinal (antacids, PPIs, antiemetics)", code: "GASTROINTESTINAL", active: true },
    { label: "Corticosteroids", code: "CORTICOSTEROID", active: true },
    { label: "Hormones & Contraceptives", code: "HORMONE", active: true },
    { label: "Psychotropics", code: "PSYCHOTROPIC", active: true },
    { label: "Anticonvulsants", code: "ANTICONVULSANT", active: true },
    { label: "IV Fluids & Electrolytes", code: "FLUIDS", active: true },
    { label: "Vitamins & Supplements", code: "VITAMIN", active: true },
    { label: "Haematinics", code: "HAEMATINIC", active: true },
    { label: "Vaccines & Sera", code: "VACCINE", active: true },
    { label: "Dermatological (topical)", code: "DERMATOLOGICAL", active: true },
    { label: "Eye, Ear & Nose", code: "EYE_EAR_NOSE", active: true },
    { label: "Anaesthetics", code: "ANAESTHETIC", active: true },
    { label: "Other", code: "OTHER", active: true, system: true },
  ],
  "drug-classes": [
    { label: "Simple analgesic", code: "ANALGESIC", active: true, system: true },
    { label: "NSAID", active: true, system: true },
    { label: "Opioid", code: "OPIOID", active: true, system: true },
    { label: "Penicillin", code: "PENICILLIN", active: true, system: true },
    { label: "Beta-lactam", code: "BETA_LACTAM", active: true, system: true },
    { label: "Cephalosporin", code: "CEPHALOSPORIN", active: true, system: true },
    { label: "Carbapenem", code: "CARBAPENEM", active: true },
    { label: "Macrolide", code: "MACROLIDE", active: true },
    { label: "Tetracycline", code: "TETRACYCLINE", active: true },
    { label: "Aminoglycoside", code: "AMINOGLYCOSIDE", active: true },
    { label: "Fluoroquinolone", code: "FLUOROQUINOLONE", active: true, system: true },
    { label: "Sulfonamide", code: "SULFONAMIDE", active: true },
    { label: "Nitroimidazole", code: "NITROIMIDAZOLE", active: true, system: true },
    { label: "Antimalarial", code: "ANTIMALARIAL", active: true, system: true },
    { label: "Biguanide", code: "BIGUANIDE", active: true, system: true },
    { label: "Sulfonylurea", code: "SULFONYLUREA", active: true },
    { label: "Insulin", code: "INSULIN", active: true, system: true },
    { label: "ACE inhibitor", code: "ACE_INHIBITOR", active: true },
    { label: "Angiotensin receptor blocker", code: "ARB", active: true },
    { label: "Calcium channel blocker", code: "CALCIUM_CHANNEL_BLOCKER", active: true, system: true },
    { label: "Beta blocker", code: "BETA_BLOCKER", active: true },
    { label: "Thiazide diuretic", code: "THIAZIDE", active: true },
    { label: "Loop diuretic", code: "LOOP_DIURETIC", active: true },
    { label: "Statin", code: "STATIN", active: true },
    { label: "Anticoagulant", code: "ANTICOAGULANT", active: true },
    { label: "Proton pump inhibitor", code: "PPI", active: true, system: true },
    { label: "H2 receptor blocker", code: "H2_BLOCKER", active: true },
    { label: "Corticosteroid", code: "CORTICOSTEROID", active: true, system: true },
    { label: "Beta-2 agonist", code: "BETA_AGONIST", active: true, system: true },
    { label: "Antihistamine", code: "ANTIHISTAMINE", active: true },
    { label: "Benzodiazepine", code: "BENZODIAZEPINE", active: true },
    { label: "Iron preparation", code: "IRON", active: true, system: true },
  ],
  "leave-types": [
    { label: "Annual Leave", code: "ANNUAL", active: true, system: true, meta: { paid: true } },
    { label: "Sick Leave", code: "SICK", active: true, system: true, meta: { paid: true } },
    { label: "Maternity Leave", code: "MAT", active: true, system: true, meta: { paid: true } },
    { label: "Paternity Leave", code: "PAT", active: true },
    { label: "Compassionate Leave", code: "COMP", active: true },
    { label: "Study Leave", code: "STUDY", active: true },
    { label: "Leave of Absence (unpaid)", code: "LOA", active: true, meta: { paid: false } },
  ],
  "employment-types": [
    { label: "Full-time (permanent)", code: "FT", active: true, system: true },
    { label: "Contract (fixed-term)", code: "CT", active: true, system: true },
    { label: "Locum", code: "LOC", active: true },
    { label: "Part-time", code: "PT", active: true },
    { label: "NYSC / Internship", code: "INT", active: true },
  ],
  "document-types": [
    { label: "National ID (NIN)", code: "NIN", active: true, system: true, meta: { mandatory: true, expires: false } },
    { label: "Curriculum Vitae", code: "CV", active: true, system: true, meta: { mandatory: true } },
    { label: "Signed Offer Letter", code: "OFFER", active: true, meta: { mandatory: true } },
    { label: "Degree Certificate", code: "DEGREE", active: true },
    { label: "Professional Practising Licence", code: "LICENCE", active: true, meta: { expires: true } },
    { label: "NYSC Discharge Certificate", code: "NYSC", active: true },
    { label: "Reference Letter", code: "REF", active: true },
    { label: "Guarantor Form", code: "GUAR", active: true },
    { label: "Medical Fitness Certificate", code: "MEDFIT", active: true, meta: { expires: true } },
  ],
  "certification-types": [
    { label: "MDCN Annual Practising Licence", code: "MDCN", active: true, meta: { renewalMonths: 12 } },
    { label: "Nursing & Midwifery Council Licence", code: "NMCN", active: true, meta: { renewalMonths: 36 } },
    { label: "MLSCN Licence (Lab Scientist)", code: "MLSCN", active: true, meta: { renewalMonths: 12 } },
    { label: "PCN Licence (Pharmacist)", code: "PCN", active: true, meta: { renewalMonths: 12 } },
    { label: "Radiographers Registration Board Licence", code: "RRBN", active: true, meta: { renewalMonths: 12 } },
    { label: "BLS / ACLS Certification", code: "BLS", active: true, meta: { renewalMonths: 24 } },
  ],
  "query-types": [
    { label: "Absence without leave", code: "AWOL", active: true },
    { label: "Lateness / punctuality", code: "LATE", active: true },
    { label: "Insubordination", code: "INSUB", active: true },
    { label: "Negligence of duty", code: "NEGL", active: true },
    { label: "Breach of policy", code: "POLICY", active: true },
    { label: "Misconduct", code: "MISCON", active: true },
  ],
  "recruitment-statuses": [
    { label: "Applied", code: "APPLIED", active: true, system: true },
    { label: "Screening", code: "SCREEN", active: true },
    { label: "Shortlisted", code: "SHORT", active: true },
    { label: "Interview", code: "INTERVIEW", active: true },
    { label: "Assessment", code: "ASSESS", active: true },
    { label: "Reference Check", code: "REFCHK", active: true },
    { label: "Offer", code: "OFFER", active: true },
    { label: "Hired", code: "HIRED", active: true, system: true, meta: { terminal: true } },
    { label: "Rejected", code: "REJECTED", active: true, system: true, meta: { terminal: true } },
    { label: "Withdrawn", code: "WITHDRAWN", active: true, meta: { terminal: true } },
  ],
  "vacancy-types": [
    { label: "New position", code: "NEW", active: true },
    { label: "Replacement (exit)", code: "REPL", active: true },
    { label: "Temporary cover", code: "TEMP", active: true },
    { label: "Additional headcount", code: "ADD", active: true },
  ],
  "handover-item-types": [
    { label: "Outstanding task", code: "TASK", active: true, system: true },
    { label: "Active project", code: "PROJECT", active: true, system: true },
    { label: "Pending approval", code: "APPROVAL", active: true },
    { label: "Key document", code: "DOC", active: true },
    { label: "Allocated asset", code: "ASSET", active: true },
    { label: "Direct report", code: "REPORT", active: true },
    { label: "External contact / relationship", code: "CONTACT", active: true },
    { label: "Open issue", code: "ISSUE", active: true },
  ],
  "loan-types": [
    { label: "Staff Advance", code: "ADV", active: true, meta: { maxMonths: 3, autoDebit: true } },
    { label: "Personal Loan", code: "PERS", active: true, meta: { maxMonths: 12, autoDebit: true } },
    { label: "Asset Loan (vehicle / device)", code: "ASSET", active: true, meta: { maxMonths: 24 } },
    { label: "Emergency Medical Loan", code: "MED", active: true, meta: { maxMonths: 6 } },
  ],
  "id-types": [
    { label: "National Identification Number (NIN)", code: "NIN", active: true, system: true },
    { label: "International Passport", code: "PASSPORT", active: true },
    { label: "Driver's Licence", code: "DL", active: true },
    { label: "Permanent Voter's Card", code: "PVC", active: true },
  ],
  "ward-types": [
    { label: "General Ward", code: "GEN", active: true, system: true },
    { label: "Maternity Ward", code: "MAT", active: true },
    { label: "Paediatric Ward", code: "PAED", active: true },
    { label: "Private / Amenity", code: "PRIV", active: true },
    { label: "Isolation Ward", code: "ISO", active: true },
    { label: "Intensive Care Unit", code: "ICU", active: true },
  ],
  "bed-types": [
    { label: "Standard Bed", code: "STD", active: true, system: true },
    { label: "VIP Bed", code: "VIP", active: true },
    { label: "Cot", code: "COT", active: true },
    { label: "Incubator", code: "INCU", active: true },
    { label: "Recovery Bed", code: "REC", active: true },
  ],
  "lab-sample-types": [
    { label: "Whole Blood", code: "WB", active: true, system: true },
    { label: "Serum", code: "SER", active: true },
    { label: "Plasma", code: "PLA", active: true },
    { label: "Urine", code: "URN", active: true },
    { label: "Stool", code: "STL", active: true },
    { label: "Swab", code: "SWB", active: true },
    { label: "CSF", active: true },
    { label: "Tissue / Biopsy", code: "TIS", active: true },
  ],
  "lab-stage-types": [
    { label: "Sample Collection", code: "COLLECT", active: true, system: true },
    { label: "Registration / Accessioning", code: "ACCESSION", active: true },
    { label: "Centrifugation / Preparation", code: "PREP", active: true },
    { label: "Screening / Dipstick", code: "SCREEN", active: true },
    { label: "Primary Analysis", code: "PRIMARY", active: true },
    { label: "Secondary / Confirmatory Analysis", code: "SECONDARY", active: true },
    { label: "Microscopy", code: "MICRO", active: true },
    { label: "Culture & Sensitivity", code: "CULTURE", active: true },
    { label: "Final Review", code: "REVIEW", active: true },
    { label: "Chief Scientist Approval", code: "APPROVAL", active: true, system: true },
  ],
  "expense-categories": [
    { label: "Travel & Transport", code: "TRAVEL", active: true },
    { label: "Training & Conferences", code: "TRAIN", active: true },
    { label: "Meals & Entertainment", code: "MEALS", active: true },
    { label: "Office Supplies", code: "SUPPLIES", active: true },
    { label: "Medical Consumables (petty)", code: "CONSUM", active: true },
  ],
};

const rid = () => Math.random().toString(36).slice(2, 9);

type MasterDataState = {
  data: Record<string, MasterItem[]>;
  items: (category: string) => MasterItem[];
  activeItems: (category: string) => MasterItem[];
  itemById: (category: string, id?: string) => MasterItem | undefined;
  label: (category: string, id?: string) => string;
  byCode: (category: string, code: string) => MasterItem | undefined;
  addItem: (category: string, input: { label: string; code?: string; meta?: MasterItem["meta"] }) => string;
  updateItem: (category: string, id: string, patch: Partial<Omit<MasterItem, "id" | "system">>) => void;
  toggleActive: (category: string, id: string) => void;
  removeItem: (category: string, id: string) => void;
};

const buildSeed = () =>
  Object.fromEntries(
    MASTER_CATEGORIES.map((c) => [c.key, (seedItems[c.key] ?? []).map((i) => ({ ...i, id: `md-${rid()}` }))]),
  );

export const useMasterData = create<MasterDataState>(
  persisted<MasterDataState>("master-data", (set, get) => ({
    data: buildSeed(),
    items: (category) => get().data[category] ?? [],
    activeItems: (category) => (get().data[category] ?? []).filter((i) => i.active),
    itemById: (category, id) => (get().data[category] ?? []).find((i) => i.id === id),
    label: (category, id) => get().itemById(category, id)?.label ?? "—",
    byCode: (category, code) => (get().data[category] ?? []).find((i) => i.code === code),
    addItem: (category, input) => {
      const id = `md-${rid()}`;
      set((s) => ({ data: { ...s.data, [category]: [...(s.data[category] ?? []), { id, label: input.label, code: input.code, active: true, meta: input.meta }] } }));
      audit(`added "${input.label}" to ${category}`, `platform/master-data/${category}`);
      return id;
    },
    updateItem: (category, id, patch) =>
      set((s) => ({ data: { ...s.data, [category]: (s.data[category] ?? []).map((i) => (i.id === id ? { ...i, ...patch } : i)) } })),
    toggleActive: (category, id) => {
      set((s) => ({ data: { ...s.data, [category]: (s.data[category] ?? []).map((i) => (i.id === id ? { ...i, active: !i.active } : i)) } }));
      audit(`toggled ${category} item ${id}`, `platform/master-data/${category}`);
    },
    removeItem: (category, id) => {
      const it = get().itemById(category, id);
      if (it?.system) return;
      set((s) => ({ data: { ...s.data, [category]: (s.data[category] ?? []).filter((i) => i.id !== id) } }));
      audit(`removed ${category} item "${it?.label ?? id}"`, `platform/master-data/${category}`);
    },
  })),
);
