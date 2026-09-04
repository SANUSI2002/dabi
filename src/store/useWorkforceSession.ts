import { create } from "zustand";
import { useHr } from "@/store/useHr";

/**
 * WBiz V3 persona switcher + data scope.
 * Mirrors the reference implementation's role model (BL-2.1.4):
 * every workforce screen renders "within your data scope".
 */
export type WfRole =
  | "Tenant HR Administrator"
  | "Line Manager"
  | "Employee"
  | "Scheduler"
  | "Auditor";

export type WfPersona = {
  id: string;
  staffId: string;
  role: WfRole;
  reports?: string[]; // staffIds a Line Manager oversees
};

export const WF_PERSONAS: WfPersona[] = [
  { id: "USR-ADMIN", staffId: "s1", role: "Tenant HR Administrator" },
  { id: "USR-MANAGER", staffId: "s2", role: "Line Manager", reports: ["s2", "s3", "s5"] },
  { id: "USR-MARY", staffId: "s3", role: "Employee" },
  { id: "USR-SAM", staffId: "s7", role: "Employee" },
  { id: "USR-SCHED", staffId: "s6", role: "Scheduler" },
  { id: "USR-AUDIT", staffId: "s4", role: "Auditor" },
];

type SessionState = {
  personaId: string;
  setPersona: (id: string) => void;
};

export const useWorkforceSession = create<SessionState>((set) => ({
  personaId: "USR-ADMIN",
  setPersona: (personaId) => set({ personaId }),
}));

export type WfScope = {
  persona: WfPersona;
  role: WfRole;
  staffId: string;
  name: string;
  /** staff ids visible to this persona */
  visibleIds: string[];
  inScope: (staffId: string) => boolean;
  scopeLabel: string;
  canApprove: boolean;
  canConfigure: boolean;
  canSchedule: boolean;
  canRecordOwnTime: boolean;
  readOnly: boolean;
  /** true when the persona only ever sees themselves */
  selfOnly: boolean;
};

export function wfScope(): WfScope {
  const personaId = useWorkforceSession.getState().personaId;
  const persona = WF_PERSONAS.find((p) => p.id === personaId) ?? WF_PERSONAS[0];
  const allStaff = useHr.getState().staff.map((s) => s.id);
  const name = useHr.getState().byId(persona.staffId)?.name ?? persona.staffId;

  let visibleIds = allStaff;
  let scopeLabel = "All employees";
  let selfOnly = false;

  switch (persona.role) {
    case "Employee":
      visibleIds = [persona.staffId];
      scopeLabel = "Your own records";
      selfOnly = true;
      break;
    case "Line Manager":
      visibleIds = persona.reports ?? [persona.staffId];
      scopeLabel = "Your direct reports";
      break;
    case "Scheduler":
      scopeLabel = "All employees (scheduling)";
      break;
    case "Auditor":
      scopeLabel = "All employees (read-only)";
      break;
    default:
      scopeLabel = "All employees (tenant)";
  }

  return {
    persona,
    role: persona.role,
    staffId: persona.staffId,
    name,
    visibleIds,
    inScope: (id: string) => visibleIds.includes(id),
    scopeLabel,
    canApprove: persona.role === "Tenant HR Administrator" || persona.role === "Line Manager",
    canConfigure: persona.role === "Tenant HR Administrator",
    canSchedule: persona.role === "Tenant HR Administrator" || persona.role === "Scheduler",
    canRecordOwnTime: persona.role === "Employee" || persona.role === "Tenant HR Administrator",
    readOnly: persona.role === "Auditor",
    selfOnly,
  };
}

/** Hook form — recomputes when the persona changes. */
export function useWfScope(): WfScope {
  const personaId = useWorkforceSession((s) => s.personaId);
  const staff = useHr((s) => s.staff);
  // personaId + staff in deps via selector subscription; recompute each render
  void personaId;
  void staff;
  return wfScope();
}
