import { create } from "zustand";
import { useHr } from "@/store/useHr";
import { useIdentity } from "@/store/useIdentity";
import { ACCOUNTS, accountById, type WfRole } from "@/data/accounts";
import { useLiveEmr } from "@/emr-live/session";
import { useLiveTimeMeta } from "@/workforce-live/time";

export type { WfRole };

export type WfPersona = {
  id: string;
  staffId: string;
  role: WfRole;
  reports?: string[];
};

/** Personas an admin can "view as" — every sign-in account plus every other
 *  staff member as a plain Employee. */
export function personaOptions(): WfPersona[] {
  const fromAccounts = ACCOUNTS.map((a) => ({ id: a.id, staffId: a.id, role: a.wfRole, reports: a.reports }));
  const known = new Set(fromAccounts.map((p) => p.staffId));
  const rest = useHr.getState().staff
    .filter((s) => !known.has(s.id))
    .map((s) => ({ id: s.id, staffId: s.id, role: "Employee" as WfRole }));
  return [...fromAccounts, ...rest];
}

type SessionState = {
  /** admin-only override; null = act as the signed-in user */
  viewAsId: string | null;
  setViewAs: (id: string | null) => void;
};

export const useWorkforceSession = create<SessionState>((set) => ({
  viewAsId: null,
  setViewAs: (viewAsId) => set({ viewAsId }),
}));

export type WfScope = {
  persona: WfPersona;
  role: WfRole;
  staffId: string;
  name: string;
  /** the signed-in user, regardless of any view-as override */
  selfId: string;
  selfName: string;
  selfRole: WfRole;
  isViewingAs: boolean;
  canViewAs: boolean;
  visibleIds: string[];
  inScope: (staffId: string) => boolean;
  scopeLabel: string;
  canApprove: boolean;
  canConfigure: boolean;
  canSchedule: boolean;
  canRecordOwnTime: boolean;
  readOnly: boolean;
  selfOnly: boolean;
};

function personaFor(staffId: string): WfPersona {
  const acct = ACCOUNTS.find((a) => a.id === staffId);
  if (acct) return { id: acct.id, staffId: acct.id, role: acct.wfRole, reports: acct.reports };
  return { id: staffId, staffId, role: "Employee" };
}

/** A live organization: who you are comes from your linked employee record and your permissions. */
function liveScope(): WfScope {
  const access = useLiveEmr.getState().access;
  const user = useLiveEmr.getState().user;
  const meta = useLiveTimeMeta.getState();
  const can = (p: string) => access?.permissions.includes(p) ?? false;
  const staff = useHr.getState().staff;
  const selfId = meta.selfEmployeeId ?? "";
  const role: WfRole = can("workforce.manage") ? "Tenant HR Administrator" : meta.reportIds.length ? "Line Manager" : "Employee";
  const visibleIds = meta.seesEveryone ? staff.map((s) => s.id) : [selfId, ...meta.reportIds].filter(Boolean);
  const name = useHr.getState().byId(selfId)?.name ?? user?.name ?? "You";
  return {
    persona: { id: selfId, staffId: selfId, role, reports: meta.reportIds }, role, staffId: selfId, name,
    selfId, selfName: name, selfRole: role, isViewingAs: false, canViewAs: false,
    visibleIds, inScope: (id: string) => visibleIds.includes(id),
    scopeLabel: meta.seesEveryone ? "All employees" : meta.reportIds.length ? "You and your direct reports" : "Your own records",
    canApprove: can("workforce.approve") || meta.reportIds.length > 0, canConfigure: can("workforce.manage"), canSchedule: can("workforce.manage"),
    canRecordOwnTime: !!meta.selfEmployeeId && can("workforce.self"), readOnly: false, selfOnly: !meta.seesEveryone && meta.reportIds.length === 0,
  };
}

export function wfScope(): WfScope {
  if (useLiveEmr.getState().status === "ready" && useLiveEmr.getState().access) return liveScope();
  const signedIn = useIdentity.getState().user;
  const self = personaFor(signedIn.id);
  const canViewAs = self.role === "Tenant HR Administrator";

  const viewAsId = useWorkforceSession.getState().viewAsId;
  const isViewingAs = canViewAs && !!viewAsId && viewAsId !== signedIn.id;
  const persona = isViewingAs ? personaFor(viewAsId!) : self;

  const allStaff = useHr.getState().staff.map((s) => s.id);
  const name = useHr.getState().byId(persona.staffId)?.name ?? accountById(persona.staffId).name;

  let visibleIds = allStaff;
  let scopeLabel = "All employees (tenant)";
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
  }

  return {
    persona,
    role: persona.role,
    staffId: persona.staffId,
    name,
    selfId: signedIn.id,
    selfName: signedIn.name,
    selfRole: self.role,
    isViewingAs,
    canViewAs,
    visibleIds,
    inScope: (id: string) => visibleIds.includes(id),
    scopeLabel,
    canApprove: persona.role === "Tenant HR Administrator" || persona.role === "Line Manager",
    canConfigure: persona.role === "Tenant HR Administrator",
    canSchedule: persona.role === "Tenant HR Administrator" || persona.role === "Scheduler",
    canRecordOwnTime: persona.role === "Employee" || persona.role === "Line Manager" || persona.role === "Tenant HR Administrator",
    readOnly: persona.role === "Auditor",
    selfOnly,
  };
}

/** Hook form — recomputes when identity, view-as, or staff change. */
export function useWfScope(): WfScope {
  const viewAsId = useWorkforceSession((s) => s.viewAsId);
  const user = useIdentity((s) => s.user);
  const staff = useHr((s) => s.staff);
  const live = useLiveTimeMeta();
  void viewAsId;
  void user;
  void staff;
  void live;
  return wfScope();
}
