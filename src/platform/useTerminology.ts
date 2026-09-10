import { create } from "zustand";
import { persisted } from "./persist";
import { audit } from "@/store/useAudit";

// Configurable organisation terminology (Phase 6).
// One hospital says "Chief Medical Director → Medical Director → HOD"; another
// says "Hospital Administrator → Director of Laboratory → Chief Laboratory
// Scientist". The app renders labels through `term(key)` so a customer can
// re-badge the hierarchy without a code change.

export const TERM_KEYS = [
  "organisation",
  "branch",
  "department",
  "hod",
  "deputyHod",
  "supervisor",
  "lineManager",
  "manager",
  "seniorManager",
  "director",
  "executive",
  "employee",
  "staff",
] as const;

export type TermKey = (typeof TERM_KEYS)[number];

const DEFAULTS: Record<TermKey, { singular: string; plural: string }> = {
  organisation: { singular: "Organisation", plural: "Organisations" },
  branch: { singular: "Branch", plural: "Branches" },
  department: { singular: "Department", plural: "Departments" },
  hod: { singular: "Head of Department", plural: "Heads of Department" },
  deputyHod: { singular: "Deputy Head of Department", plural: "Deputy Heads of Department" },
  supervisor: { singular: "Supervisor", plural: "Supervisors" },
  lineManager: { singular: "Line Manager", plural: "Line Managers" },
  manager: { singular: "Manager", plural: "Managers" },
  seniorManager: { singular: "Senior Manager", plural: "Senior Managers" },
  director: { singular: "Director", plural: "Directors" },
  executive: { singular: "Executive", plural: "Executives" },
  employee: { singular: "Employee", plural: "Employees" },
  staff: { singular: "Staff member", plural: "Staff" },
};

type TerminologyState = {
  overrides: Partial<Record<TermKey, { singular?: string; plural?: string }>>;
  label: (key: TermKey, form?: "singular" | "plural") => string;
  setTerm: (key: TermKey, patch: { singular?: string; plural?: string }) => void;
  reset: (key?: TermKey) => void;
  defaults: typeof DEFAULTS;
};

export const useTerminology = create<TerminologyState>(
  persisted<TerminologyState>("terminology", (set, get) => ({
    overrides: {},
    defaults: DEFAULTS,
    label: (key, form = "singular") => {
      const o = get().overrides[key];
      return (o && o[form]) || DEFAULTS[key][form];
    },
    setTerm: (key, patch) => {
      set((s) => ({ overrides: { ...s.overrides, [key]: { ...s.overrides[key], ...patch } } }));
      audit(`renamed "${DEFAULTS[key].singular}" to "${patch.singular ?? get().label(key)}"`, `platform/terminology/${key}`);
    },
    reset: (key) => {
      if (key) set((s) => { const n = { ...s.overrides }; delete n[key]; return { overrides: n }; });
      else set({ overrides: {} });
      audit(key ? `reset terminology "${key}"` : "reset all terminology", "platform/terminology");
    },
  })),
);

/** non-hook accessor for use inside data builders / other stores */
export const term = (key: TermKey, form: "singular" | "plural" = "singular") => useTerminology.getState().label(key, form);
