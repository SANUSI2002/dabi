import { create } from "zustand";
import * as seed from "@/data/onboarding";
import { audit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import { useEmployees } from "@/store/useEmployees";
import type { OnboardingProgress } from "@/data/onboarding";

const rid = () => Math.random().toString(36).slice(2, 9);

type OnboardingState = {
  stages: typeof seed.stages;
  tasks: typeof seed.tasks;
  progress: OnboardingProgress[];

  startOnboarding: (input: { candidateId: string; candidateName: string; requisitionId: string; jobPositionId: string; departmentId: string }) => void;
  toggleTask: (progressId: string, taskId: string) => void;
  canAdvance: (progressId: string) => boolean;
  advanceStage: (progressId: string) => void;
  convertToEmployee: (progressId: string, role: string, cadre: string) => string | undefined;
};

export const useOnboarding = create<OnboardingState>((set, get) => ({
  stages: seed.stages,
  tasks: seed.tasks,
  progress: [],

  startOnboarding: (input) => {
    if (get().progress.some((p) => p.candidateId === input.candidateId)) return;
    audit("started onboarding", `hr/onboarding/${input.candidateName}`);
    set((s) => ({
      progress: [
        {
          id: rid(), ...input, currentStageId: seed.stages[0].id, taskDone: {}, startedAt: new Date().toISOString(),
        },
        ...s.progress,
      ],
    }));
  },

  toggleTask: (progressId, taskId) => {
    set((s) => ({
      progress: s.progress.map((p) =>
        p.id === progressId ? { ...p, taskDone: { ...p.taskDone, [taskId]: !p.taskDone[taskId] } } : p,
      ),
    }));
  },

  canAdvance: (progressId) => {
    const p = get().progress.find((x) => x.id === progressId);
    if (!p) return false;
    const required = get().tasks.filter((t) => t.stageId === p.currentStageId && t.isRequired);
    return required.every((t) => p.taskDone[t.id]);
  },

  advanceStage: (progressId) => {
    const p = get().progress.find((x) => x.id === progressId);
    if (!p || !get().canAdvance(progressId)) return;
    const stage = get().stages.find((s) => s.id === p.currentStageId)!;
    const next = get().stages.find((s) => s.sequence === stage.sequence + 1);
    audit("advanced onboarding stage", `hr/onboarding/${p.candidateName}`);
    set((s) => ({
      progress: s.progress.map((x) =>
        x.id === progressId
          ? { ...x, currentStageId: next?.id ?? x.currentStageId, completedAt: stage.isFinal ? new Date().toISOString() : x.completedAt }
          : x,
      ),
    }));
  },

  convertToEmployee: (progressId, role, cadre) => {
    const p = get().progress.find((x) => x.id === progressId);
    if (!p || p.employeeId) return p?.employeeId;
    audit("converted candidate to employee", `hr/onboarding/${p.candidateName}`);
    useHr.getState().addStaff({
      name: p.candidateName, role, cadre, phone: "", email: "",
      hireDate: new Date().toISOString(),
    } as never);
    // useHr.addStaff doesn't return the new id — look it up by name (freshly added, unique enough for the demo)
    const created = useHr.getState().staff.find((s) => s.name === p.candidateName);
    if (created) {
      useEmployees.getState().upsertProfile(created.id, {
        companyId: "co1", departmentId: p.departmentId, jobPositionId: p.jobPositionId,
        employeeTypeId: "et1", dateJoining: new Date().toISOString(),
      });
    }
    set((s) => ({ progress: s.progress.map((x) => (x.id === progressId ? { ...x, employeeId: created?.id } : x)) }));
    return created?.id;
  },
}));
