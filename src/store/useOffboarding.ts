import { create } from "zustand";
import * as seed from "@/data/offboarding";
import { audit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import type { OffboardingCase } from "@/data/offboarding";

const rid = () => Math.random().toString(36).slice(2, 9);
const who = (id: string) => useHr.getState().byId(id)?.name ?? id;

type OffboardingState = {
  stages: typeof seed.stages;
  cases: OffboardingCase[];

  initiate: (employeeId: string, reason: string, lastWorkingDate: string) => void;
  recordExitInterview: (caseId: string, notes: string) => void;
  recordHandover: (caseId: string, notes: string) => void;
  settleFnf: (caseId: string, amount: number) => void;
  canAdvance: (caseId: string) => boolean;
  advanceStage: (caseId: string) => void;
};

export const useOffboarding = create<OffboardingState>((set, get) => ({
  stages: seed.stages,
  cases: seed.cases,

  initiate: (employeeId, reason, lastWorkingDate) => {
    if (get().cases.some((c) => c.employeeId === employeeId && c.status === "Ongoing")) return;
    audit("initiated offboarding", `hr/offboarding/${who(employeeId)}`);
    set((s) => ({
      cases: [
        { id: rid(), employeeId, reason, noticeDate: new Date().toISOString(), lastWorkingDate, currentStageId: seed.stages[0].id, status: "Ongoing", fnfSettled: false, createdAt: new Date().toISOString() },
        ...s.cases,
      ],
    }));
  },

  recordExitInterview: (caseId, notes) => {
    audit("recorded exit interview", `hr/offboarding/${caseId}`);
    set((s) => ({ cases: s.cases.map((c) => (c.id === caseId ? { ...c, exitInterviewNotes: notes } : c)) }));
  },

  recordHandover: (caseId, notes) => {
    audit("recorded work handover", `hr/offboarding/${caseId}`);
    set((s) => ({ cases: s.cases.map((c) => (c.id === caseId ? { ...c, handoverNotes: notes } : c)) }));
  },

  settleFnf: (caseId, amount) => {
    audit("settled FNF", `hr/offboarding/${caseId}`);
    set((s) => ({ cases: s.cases.map((c) => (c.id === caseId ? { ...c, fnfAmount: amount, fnfSettled: true } : c)) }));
  },

  canAdvance: (caseId) => {
    const c = get().cases.find((x) => x.id === caseId);
    if (!c) return false;
    const stage = get().stages.find((s) => s.id === c.currentStageId);
    if (!stage) return false;
    if (stage.type === "Exit Interview") return !!c.exitInterviewNotes;
    if (stage.type === "Work Handover") return !!c.handoverNotes;
    if (stage.type === "FNF Settlement") return c.fnfSettled;
    return true;
  },

  advanceStage: (caseId) => {
    const c = get().cases.find((x) => x.id === caseId);
    if (!c || !get().canAdvance(caseId)) return;
    const stage = get().stages.find((s) => s.id === c.currentStageId)!;
    const next = get().stages.find((s) => s.sequence === stage.sequence + 1);
    audit("advanced offboarding stage", `hr/offboarding/${who(c.employeeId)}`);
    const reachedFinal = next?.isFinal ?? false;
    set((s) => ({
      cases: s.cases.map((x) =>
        x.id === caseId
          ? { ...x, currentStageId: next?.id ?? x.currentStageId, status: reachedFinal ? "Completed" : x.status, completedAt: reachedFinal ? new Date().toISOString() : x.completedAt }
          : x,
      ),
    }));
    if (reachedFinal) {
      audit("deactivated staff (offboarding complete)", `hr/offboarding/${who(c.employeeId)}`);
      useHr.getState().setStatus(c.employeeId, "Inactive");
    }
  },
}));
