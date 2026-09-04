import { create } from "zustand";
import * as seed from "@/data/performance";
import { audit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import type { Objective, EmployeeObjective, ObjectiveStatus, Feedback, FeedbackAnswer, Meeting, ReviewPeriod } from "@/data/performance";

const rid = () => Math.random().toString(36).slice(2, 9);
const who = (id: string) => useHr.getState().byId(id)?.name ?? id;

type PerformanceState = {
  periods: ReviewPeriod[];
  keyResults: typeof seed.keyResults;
  objectives: Objective[];
  employeeObjectives: EmployeeObjective[];
  feedbacks: Feedback[];
  meetings: Meeting[];

  addPeriod: (p: Omit<ReviewPeriod, "id">) => void;
  addObjective: (o: Omit<Objective, "id">) => void;
  updateKeyResultValue: (employeeObjectiveId: string, ekrId: string, currentValue: number) => void;
  setObjectiveStatus: (employeeObjectiveId: string, status: ObjectiveStatus) => void;

  startFeedback: (input: { reviewCycle: string; employeeId: string; managerId?: string; colleagueIds: string[] }) => void;
  submitFeedback: (feedbackId: string, role: "self" | "manager", answers: FeedbackAnswer[]) => void;

  scheduleMeeting: (m: Omit<Meeting, "id" | "status">) => void;
  completeMeeting: (id: string, notes: string, actionItems: string) => void;
};

export const usePerformance = create<PerformanceState>((set, get) => ({
  periods: seed.periods,
  keyResults: seed.keyResults,
  objectives: seed.objectives,
  employeeObjectives: seed.employeeObjectives,
  feedbacks: seed.feedbacks,
  meetings: seed.meetings,

  addPeriod: (p) => {
    audit("added review period", `hr/performance/period/${p.name}`);
    set((s) => ({ periods: [{ ...p, id: rid() }, ...s.periods] }));
  },

  addObjective: (o) => {
    audit("created objective", `hr/performance/objective/${o.title}`);
    const id = rid();
    const krCatalog = get().keyResults;
    const newEmployeeObjectives: EmployeeObjective[] = o.assigneeIds.map((employeeId) => ({
      id: rid(),
      objectiveId: id,
      employeeId,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + o.duration * (o.durationUnit === "Days" ? 1 : o.durationUnit === "Months" ? 30 : 365) * 864e5).toISOString(),
      status: "Not Started",
      progressPercentage: 0,
      keyResults: o.keyResultIds.map((krId) => {
        const kr = krCatalog.find((x) => x.id === krId);
        return { id: rid(), keyResultId: krId, title: kr?.title ?? krId, type: kr?.type ?? "Numeric", currentValue: 0, targetValue: kr?.targetValue ?? 100 };
      }),
    }));
    set((s) => ({
      objectives: [{ ...o, id }, ...s.objectives],
      employeeObjectives: [...newEmployeeObjectives, ...s.employeeObjectives],
    }));
  },

  updateKeyResultValue: (employeeObjectiveId, ekrId, currentValue) => {
    set((s) => ({
      employeeObjectives: s.employeeObjectives.map((eo) => {
        if (eo.id !== employeeObjectiveId) return eo;
        const keyResults = eo.keyResults.map((kr) => (kr.id === ekrId ? { ...kr, currentValue } : kr));
        const progressPercentage = Math.round(
          keyResults.reduce((n, kr) => n + Math.min(100, (kr.currentValue / (kr.targetValue || 1)) * 100), 0) / keyResults.length,
        );
        const status: ObjectiveStatus = progressPercentage >= 100 ? "Closed" : progressPercentage > 0 ? eo.status === "Not Started" ? "On Track" : eo.status : "Not Started";
        return { ...eo, keyResults, progressPercentage, status };
      }),
    }));
    audit("updated key result progress", `hr/performance/objective/${employeeObjectiveId}`);
  },

  setObjectiveStatus: (employeeObjectiveId, status) => {
    audit(`objective marked ${status.toLowerCase()}`, `hr/performance/objective/${employeeObjectiveId}`);
    set((s) => ({ employeeObjectives: s.employeeObjectives.map((eo) => (eo.id === employeeObjectiveId ? { ...eo, status } : eo)) }));
  },

  startFeedback: (input) => {
    audit("started 360 feedback", `hr/performance/feedback/${who(input.employeeId)}`);
    set((s) => ({
      feedbacks: [{ id: rid(), status: "In Progress", startDate: new Date().toISOString(), ...input }, ...s.feedbacks],
    }));
  },

  submitFeedback: (feedbackId, role, answers) => {
    audit(`submitted ${role} feedback`, `hr/performance/feedback/${feedbackId}`);
    set((s) => ({
      feedbacks: s.feedbacks.map((f) => {
        if (f.id !== feedbackId) return f;
        const updated = role === "self" ? { ...f, selfAnswers: answers } : { ...f, managerAnswers: answers };
        const closed = !!updated.selfAnswers && !!updated.managerAnswers;
        return { ...updated, status: closed ? "Closed" : "In Progress", endDate: closed ? new Date().toISOString() : updated.endDate };
      }),
    }));
  },

  scheduleMeeting: (m) => {
    audit("scheduled 1-on-1", `hr/performance/meeting/${who(m.employeeId)}`);
    set((s) => ({ meetings: [{ ...m, id: rid(), status: "Scheduled" }, ...s.meetings] }));
  },

  completeMeeting: (id, notes, actionItems) => {
    audit("completed 1-on-1", `hr/performance/meeting/${id}`);
    set((s) => ({ meetings: s.meetings.map((m) => (m.id === id ? { ...m, status: "Completed", notes, actionItems } : m)) }));
  },
}));
