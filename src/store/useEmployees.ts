import { create } from "zustand";
import { differenceInCalendarDays } from "date-fns";
import * as seed from "@/data/hrProfile";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import type { EmployeeProfile, EmployeeDocument, DisciplinaryAction, EmployeeNote, BonusPoints, DocumentCategory, Policy, PolicyCategory } from "@/data/hrProfile";

const rid = () => Math.random().toString(36).slice(2, 9);
const me = () => useIdentity.getState().user.name;

type EmployeesState = {
  profiles: EmployeeProfile[];
  documents: EmployeeDocument[];
  actionTypes: typeof seed.actionTypes;
  disciplinaryActions: DisciplinaryAction[];
  notes: EmployeeNote[];
  bonusPoints: BonusPoints[];
  policies: Policy[];
  addPolicy: (p: { category: PolicyCategory; title: string; purpose: string; body: string }) => void;
  addActionType: (name: string, blockOption: boolean) => void;

  profileFor: (staffId: string) => EmployeeProfile | undefined;
  upsertProfile: (staffId: string, patch: Partial<Omit<EmployeeProfile, "id">>) => void;

  requestDocument: (employeeIds: string[], title: string, category: DocumentCategory, notifyBeforeDays?: number) => void;
  uploadDocument: (id: string, data: { issueDate?: string; expiryDate?: string }) => void;
  reviewDocument: (id: string, status: "Approved" | "Rejected", rejectReason?: string) => void;
  expiringDocuments: (withinDays: number) => (EmployeeDocument & { daysLeft: number })[];

  addDisciplinaryAction: (a: Omit<DisciplinaryAction, "id">) => void;
  addNote: (employeeId: string, note: string) => void;
  adjustBonus: (employeeId: string, delta: number, reason: string) => void;
  bonusFor: (employeeId: string) => number;
};

export const useEmployees = create<EmployeesState>((set, get) => ({
  profiles: seed.profiles,
  documents: seed.documents,
  actionTypes: seed.actionTypes,
  disciplinaryActions: seed.disciplinaryActions,
  notes: seed.notes,
  bonusPoints: seed.bonusPoints,
  policies: seed.policies,

  addPolicy: (p) => {
    audit("published policy", `hr/policy/${p.title}`);
    set((s) => ({ policies: [{ ...p, id: rid(), updatedAt: new Date().toISOString() }, ...s.policies] }));
  },

  addActionType: (name, blockOption) => {
    audit("added disciplinary action type", `hr/action-type/${name}`);
    set((s) => ({ actionTypes: [...s.actionTypes, { id: rid(), name, blockOption }] }));
  },

  profileFor: (staffId) => get().profiles.find((p) => p.id === staffId),

  upsertProfile: (staffId, patch) => {
    audit("updated HR profile", `hr/employee/${staffId}`);
    set((s) => {
      const exists = s.profiles.some((p) => p.id === staffId);
      return {
        profiles: exists
          ? s.profiles.map((p) => (p.id === staffId ? { ...p, ...patch } : p))
          : [{ id: staffId, companyId: "co1", tagIds: [], ...patch }, ...s.profiles],
      };
    });
  },

  requestDocument: (employeeIds, title, category, notifyBeforeDays = 30) => {
    audit("requested document", `hr/document/${title}`);
    set((s) => ({
      documents: [
        ...employeeIds.map((employeeId) => ({ id: rid(), employeeId, title, category, status: "Requested" as const, notifyBeforeDays })),
        ...s.documents,
      ],
    }));
  },

  uploadDocument: (id, data) => {
    audit("uploaded document", `hr/document/${id}`);
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, ...data, status: "Uploaded" } : d)),
    }));
  },

  reviewDocument: (id, status, rejectReason) => {
    audit(`document ${status.toLowerCase()}`, `hr/document/${id}`);
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, status, rejectReason: status === "Rejected" ? rejectReason : undefined } : d)),
    }));
  },

  expiringDocuments: (withinDays) => {
    const today = new Date();
    return get()
      .documents.filter((d) => d.expiryDate)
      .map((d) => ({ ...d, daysLeft: differenceInCalendarDays(new Date(d.expiryDate!), today) }))
      .filter((d) => d.daysLeft <= withinDays)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  },

  addDisciplinaryAction: (a) => {
    audit("recorded disciplinary action", `hr/disciplinary/${a.employeeIds.join(",")}`);
    set((s) => ({ disciplinaryActions: [{ ...a, id: rid() }, ...s.disciplinaryActions] }));
  },

  addNote: (employeeId, note) => {
    audit("added HR note", `hr/employee/${employeeId}`);
    set((s) => ({ notes: [{ id: rid(), employeeId, note, by: me(), at: new Date().toISOString() }, ...s.notes] }));
  },

  adjustBonus: (employeeId, delta, reason) => {
    audit(delta >= 0 ? "awarded bonus points" : "deducted bonus points", `hr/bonus/${employeeId}`);
    const entry = { delta, reason, at: new Date().toISOString(), by: me() };
    set((s) => {
      const existing = s.bonusPoints.find((b) => b.employeeId === employeeId);
      return {
        bonusPoints: existing
          ? s.bonusPoints.map((b) => (b.employeeId === employeeId ? { ...b, points: b.points + delta, history: [entry, ...b.history] } : b))
          : [{ employeeId, points: delta, history: [entry] }, ...s.bonusPoints],
      };
    });
  },

  bonusFor: (employeeId) => get().bonusPoints.find((b) => b.employeeId === employeeId)?.points ?? 0,
}));
