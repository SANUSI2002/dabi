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
  { key: "id-types", label: "Identification Types", product: "platform", description: "NIN, passport, driver's licence, voter card" },
  { key: "ward-types", label: "Ward Types", product: "emr", description: "General, maternity, paediatric, ICU, isolation" },
  { key: "bed-types", label: "Bed Types", product: "emr", description: "Standard, VIP, cot, incubator, recovery" },
  { key: "lab-sample-types", label: "Lab Sample Types", product: "emr", description: "Blood, urine, stool, swab, CSF, tissue" },
  { key: "lab-stage-types", label: "Lab Stage Types", product: "emr", description: "Named processing stages tests can be composed from" },
  { key: "expense-categories", label: "Expense Categories", product: "accounting", description: "Categories for staff expense claims" },
];

const seedItems: Record<string, Omit<MasterItem, "id">[]> = {
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
    { label: "CSF", code: "CSF", active: true },
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
