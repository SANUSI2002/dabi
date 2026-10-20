import { create } from "zustand";
import { usePerformance } from "@/store/usePerformance";
import { usePromotions } from "@/store/usePromotions";
import { useBranchTransfers } from "@/store/useBranchTransfers";
import { useLiveEmr } from "@/emr-live/session";
import { workforceRequest } from "@/emr-live/client";
import type { EmployeeObjective, Feedback, KeyResult, Meeting, Objective, ReviewPeriod } from "@/data/performance";
import type { Promotion } from "@/data/promotions";
import type { BranchTransfer } from "@/data/branchTransfers";
import { clean, isoDay, liveChange, uuid } from "./sync";
import { loadPeople } from "./people";
import { followWorkflows, loadWorkflows } from "./workflows";

// Performance, promotions and branch transfers in live mode (GET /careers). The server shows each person
// the objectives, reviews and 1-on-1s they are part of (HR sees all) and checks who writes what. A
// promotion or transfer is approved through its workflow (decided in the Approvals inbox) and only an
// approved one can be applied to the employee record.

type ApiCareers = {
  selfEmployeeId: string | null; periods: ReviewPeriod[]; keyResults: KeyResult[]; objectives: Objective[]; employeeObjectives: EmployeeObjective[];
  feedbacks: Feedback[]; meetings: Meeting[]; promotions: (Promotion & { newSalary?: number })[]; transfers: BranchTransfer[];
};

export const useLiveCareersMeta = create<{ loaded: boolean }>(() => ({ loaded: false }));
const noNull = <T extends object>(row: T) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null)) as T;

export async function loadCareers() {
  const { data } = await workforceRequest<{ data: ApiCareers }>("/careers");
  useLiveCareersMeta.setState({ loaded: true });
  usePerformance.setState({ periods: data.periods, keyResults: data.keyResults, objectives: data.objectives, employeeObjectives: data.employeeObjectives, feedbacks: data.feedbacks.map((f) => noNull(f)), meetings: data.meetings.map((m) => noNull(m)) });
  usePromotions.setState({ promotions: data.promotions.map((p) => noNull(p)) });
  useBranchTransfers.setState({ transfers: data.transfers.map((t) => noNull(t)) });
}

const hr = () => useLiveEmr.getState().access?.permissions.includes("hr.read") ?? false;
const reload = () => loadCareers();
const reloadWith = (...more: (() => Promise<void>)[]) => async () => { await Promise.all([loadCareers(), ...more.map((load) => load())]); };
const post = (path: string, body: unknown = {}) => workforceRequest(path, { method: "POST", body });

/** Proposing, resubmitting and applying a change: one set of actions for promotions and transfers. */
function changeActions(kind: "promotions" | "transfers", trigger: "promotion" | "transfer") {
  return {
    resubmit: (id: string) => { void liveChange(() => post("/workflows/instances", { triggerType: trigger, reference: id }), reloadWith(loadWorkflows)); },
    apply: (id: string) => { void liveChange(() => post(`/careers/${kind}/${id}/apply`), reloadWith(...(hr() ? [loadPeople] : []))); },
    setSuccessor: (id: string, successorId: string | undefined, notes: string) => { void liveChange(() => post(`/careers/${kind}/${id}/handover`, clean({ successorId, notes: notes || undefined })), reload); },
    completeHandover: (id: string) => { void liveChange(() => post(`/careers/${kind}/${id}/handover`, { complete: true }), reload); },
  };
}

export function goLiveCareers() {
  followWorkflows(() => (useLiveCareersMeta.getState().loaded ? loadCareers() : Promise.resolve()));
  usePerformance.setState({
    addPeriod: (p) => { void liveChange(() => post("/careers/periods", { id: uuid(), name: p.name, startDate: isoDay(p.startDate), endDate: isoDay(p.endDate) }), reload); },
    addObjective: (o) => {
      void liveChange(() => post("/careers/objectives", clean({ id: uuid(), title: o.title, description: o.description, managerIds: o.managerIds, assigneeIds: o.assigneeIds, keyResultIds: o.keyResultIds, durationUnit: o.durationUnit, duration: o.duration })), reload);
    },
    updateKeyResultValue: (employeeObjectiveId, ekrId, currentValue) => {
      void liveChange(() => post(`/careers/employee-objectives/${employeeObjectiveId}/progress`, { keyResultId: ekrId, currentValue }), reload);
    },
    setObjectiveStatus: (employeeObjectiveId, status) => {
      void liveChange(() => post(`/careers/employee-objectives/${employeeObjectiveId}/status`, { status }), reload,
        () => usePerformance.setState((s) => ({ employeeObjectives: s.employeeObjectives.map((eo) => (eo.id === employeeObjectiveId ? { ...eo, status } : eo)) })));
    },
    startFeedback: (input) => { void liveChange(() => post("/careers/feedback", clean({ id: uuid(), reviewCycle: input.reviewCycle, employeeId: input.employeeId, managerId: input.managerId || undefined, colleagueIds: input.colleagueIds })), reload); },
    submitFeedback: (feedbackId, role, answers) => {
      void liveChange(() => post(`/careers/feedback/${feedbackId}/answers`, { role, answers: answers.map((a) => clean({ question: a.question, rating: a.rating, comment: a.comment?.trim() || undefined })) }), reload);
    },
    scheduleMeeting: (m) => { void liveChange(() => post("/careers/meetings", { id: uuid(), title: m.title, employeeId: m.employeeId, managerId: m.managerId, scheduledAt: m.scheduledAt }), reload); },
    completeMeeting: (id, notes, actionItems) => { void liveChange(() => post(`/careers/meetings/${id}/complete`, clean({ notes, actionItems: actionItems || undefined })), reload); },
  });

  const promotions = changeActions("promotions", "promotion");
  usePromotions.setState({
    propose: (input) => {
      const id = uuid();
      void liveChange(() => post("/careers/promotions", clean({ id, employeeId: input.employeeId, toJobPositionId: input.toJobPositionId, toJobRoleId: input.toJobRoleId, toCadre: input.toCadre, newSalary: input.newSalary, effectiveDate: isoDay(input.effectiveDate), reason: input.reason })), reloadWith(loadWorkflows));
      return id;
    },
    resubmit: (id) => promotions.resubmit(id),
    applyPromotion: (id) => promotions.apply(id),
    setSuccessor: promotions.setSuccessor,
    completeHandover: promotions.completeHandover,
  });
  const transfers = changeActions("transfers", "transfer");
  useBranchTransfers.setState({
    propose: (input) => {
      const id = uuid();
      void liveChange(() => post("/careers/transfers", { id, employeeId: input.employeeId, toCompanyId: input.toCompanyId, effectiveDate: isoDay(input.effectiveDate), reason: input.reason }), reloadWith(loadWorkflows));
      return id;
    },
    resubmit: (id) => transfers.resubmit(id),
    applyTransfer: (id) => transfers.apply(id),
    setSuccessor: transfers.setSuccessor,
    completeHandover: transfers.completeHandover,
  });
}

export function clearCareers() {
  useLiveCareersMeta.setState({ loaded: false });
  usePerformance.setState({ periods: [], keyResults: [], objectives: [], employeeObjectives: [], feedbacks: [], meetings: [] });
  usePromotions.setState({ promotions: [] });
  useBranchTransfers.setState({ transfers: [] });
}
