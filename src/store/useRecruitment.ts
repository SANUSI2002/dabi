import { create } from "zustand";
import * as seed from "@/data/recruitment";
import { audit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import type { JobRequisition, PipelineStage, Candidate, InterviewSchedule, StageType, TalentPoolEntry } from "@/data/recruitment";

const rid = () => Math.random().toString(36).slice(2, 9);
const who = (id?: string) => (id ? useHr.getState().byId(id)?.name ?? id : undefined);

type RecruitmentState = {
  requisitions: JobRequisition[];
  stages: PipelineStage[];
  candidates: Candidate[];
  interviews: InterviewSchedule[];
  talentPool: TalentPoolEntry[];

  addRequisition: (r: Omit<JobRequisition, "id" | "closed">) => void;
  closeRequisition: (id: string) => void;
  stagesFor: (requisitionId: string) => PipelineStage[];
  candidatesFor: (requisitionId: string) => Candidate[];

  addCandidate: (c: Omit<Candidate, "id" | "stageId" | "appliedAt" | "rating" | "hired" | "canceled">) => void;
  moveCandidate: (candidateId: string, stageId: string) => void;
  rateCandidate: (candidateId: string, rating: number) => void;
  rejectCandidate: (candidateId: string, reason: string) => void;
  hireCandidate: (candidateId: string) => void;

  scheduleInterview: (i: Omit<InterviewSchedule, "id" | "status">) => void;
  completeInterview: (id: string, feedback: string) => void;

  addToTalentPool: (candidateId: string, skillZone: string, reason: string) => void;
};

export const useRecruitment = create<RecruitmentState>((set, get) => ({
  requisitions: seed.requisitions,
  stages: seed.stages,
  candidates: seed.candidates,
  interviews: seed.interviews,
  talentPool: seed.talentPool,

  addRequisition: (r) => {
    audit("opened requisition", `hr/recruitment/${r.title}`);
    const id = rid();
    const names: [string, StageType][] = [["Applied", "Applied"], ["Screening", "Test"], ["Interview", "Interview"], ["Hired", "Hired"]];
    const newStages = names.map(([name, type], i) => ({ id: `${id}-st${i}`, requisitionId: id, name, type, sequence: i }));
    set((s) => ({
      requisitions: [{ ...r, id, closed: false }, ...s.requisitions],
      stages: [...s.stages, ...newStages],
    }));
  },

  closeRequisition: (id) => {
    audit("closed requisition", `hr/recruitment/${id}`);
    set((s) => ({ requisitions: s.requisitions.map((r) => (r.id === id ? { ...r, closed: true } : r)) }));
  },

  stagesFor: (requisitionId) => get().stages.filter((s) => s.requisitionId === requisitionId).sort((a, b) => a.sequence - b.sequence),
  candidatesFor: (requisitionId) => get().candidates.filter((c) => c.requisitionId === requisitionId),

  addCandidate: (c) => {
    const firstStage = get().stages.find((s) => s.requisitionId === c.requisitionId && s.sequence === 0);
    audit("added candidate", `hr/recruitment/candidate/${c.name}`);
    set((s) => ({
      candidates: [{ ...c, id: rid(), stageId: firstStage?.id ?? "", appliedAt: new Date().toISOString(), rating: 0, hired: false, canceled: false }, ...s.candidates],
    }));
  },

  moveCandidate: (candidateId, stageId) => {
    audit("moved candidate stage", `hr/recruitment/candidate/${candidateId}`);
    set((s) => ({ candidates: s.candidates.map((c) => (c.id === candidateId ? { ...c, stageId } : c)) }));
  },

  rateCandidate: (candidateId, rating) => {
    set((s) => ({ candidates: s.candidates.map((c) => (c.id === candidateId ? { ...c, rating } : c)) }));
  },

  rejectCandidate: (candidateId, reason) => {
    audit("rejected candidate", `hr/recruitment/candidate/${candidateId}`);
    set((s) => ({ candidates: s.candidates.map((c) => (c.id === candidateId ? { ...c, canceled: true, cancelReason: reason } : c)) }));
  },

  hireCandidate: (candidateId) => {
    const c = get().candidates.find((x) => x.id === candidateId);
    if (!c) return;
    const hiredStage = get().stages.find((s) => s.requisitionId === c.requisitionId && s.type === "Hired");
    audit("marked candidate hired", `hr/recruitment/candidate/${candidateId}`);
    set((s) => ({
      candidates: s.candidates.map((x) => (x.id === candidateId ? { ...x, hired: true, stageId: hiredStage?.id ?? x.stageId } : x)),
    }));
  },

  scheduleInterview: (i) => {
    audit("scheduled interview", `hr/recruitment/interview/${i.candidateId}`, { user: who(i.interviewerIds[0]) });
    set((s) => ({ interviews: [{ ...i, id: rid(), status: "Scheduled" }, ...s.interviews] }));
  },

  completeInterview: (id, feedback) => {
    audit("recorded interview feedback", `hr/recruitment/interview/${id}`);
    set((s) => ({ interviews: s.interviews.map((i) => (i.id === id ? { ...i, status: "Completed", feedback } : i)) }));
  },

  addToTalentPool: (candidateId, skillZone, reason) => {
    const c = get().candidates.find((x) => x.id === candidateId);
    if (!c) return;
    audit("added to talent pool", `hr/recruitment/talent-pool/${c.name}`);
    set((s) => ({
      talentPool: [{ id: rid(), skillZone, candidateName: c.name, email: c.email, phone: c.phone, reason, addedAt: new Date().toISOString() }, ...s.talentPool],
    }));
  },
}));
