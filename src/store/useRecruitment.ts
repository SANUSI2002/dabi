import { create } from "zustand";
import * as seed from "@/data/recruitment";
import { audit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import { useIdentity } from "@/store/useIdentity";
import { useMasterData } from "@/platform/useMasterData";
import type { JobRequisition, PipelineStage, Candidate, InterviewSchedule, StageType, TalentPoolEntry, ApplicantNote } from "@/data/recruitment";

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

  // Phase 19-20
  talentEntryById: (id?: string) => TalentPoolEntry | undefined;
  addTalentNote: (entryId: string, text: string) => void;
  addTalentDocument: (entryId: string, doc: { type: string; filename: string; sizeKb: number; dataUrl?: string }) => void;
  /** move a talent-pool applicant into an active requisition at a configured recruitment status */
  takeToRecruitment: (entryId: string, requisitionId: string, statusCode: string) => { ok: boolean; error?: string; candidateId?: string };
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
      talentPool: [{ id: rid(), skillZone, candidateName: c.name, email: c.email, phone: c.phone, reason, addedAt: new Date().toISOString(), fromCandidateId: c.id, history: [{ id: rid(), event: "Added to talent pool", detail: skillZone, at: new Date().toISOString() }] }, ...s.talentPool],
    }));
  },

  talentEntryById: (id) => get().talentPool.find((t) => t.id === id),
  addTalentNote: (entryId, text) => {
    const note: ApplicantNote = { id: rid(), text, by: useIdentity.getState().user.id, at: new Date().toISOString() };
    set((s) => ({ talentPool: s.talentPool.map((t) => (t.id === entryId ? { ...t, notes: [note, ...(t.notes ?? [])] } : t)) }));
    audit("added talent-pool note", `hr/recruitment/talent-pool/${entryId}`);
  },
  addTalentDocument: (entryId, doc) => {
    set((s) => ({ talentPool: s.talentPool.map((t) => (t.id === entryId ? { ...t, documents: [{ id: rid(), ...doc, uploadedAt: new Date().toISOString() }, ...(t.documents ?? [])] } : t)) }));
    audit(`attached ${doc.filename} to a talent-pool profile`, `hr/recruitment/talent-pool/${entryId}`);
  },

  takeToRecruitment: (entryId, requisitionId, statusCode) => {
    const entry = get().talentEntryById(entryId);
    const req = get().requisitions.find((r) => r.id === requisitionId);
    if (!entry || !req) return { ok: false, error: "Applicant or requisition not found." };
    const status = useMasterData.getState().byCode("recruitment-statuses", statusCode);
    if (!status) return { ok: false, error: "Unknown recruitment status." };

    // map the status to a pipeline stage on this requisition, creating one if needed
    let stage = get().stages.find((st) => st.requisitionId === requisitionId && st.name.toLowerCase() === status.label.toLowerCase());
    const candidateId = rid();
    set((s) => {
      let stages = s.stages;
      if (!stage) {
        const maxSeq = Math.max(-1, ...stages.filter((x) => x.requisitionId === requisitionId).map((x) => x.sequence));
        const type: StageType = status.meta?.terminal ? (status.code === "HIRED" ? "Hired" : "Cancelled") : status.code === "INTERVIEW" ? "Interview" : "Test";
        stage = { id: `${requisitionId}-st${maxSeq + 1}`, requisitionId, name: status.label, type, sequence: maxSeq + 1 };
        stages = [...stages, stage];
      }
      const candidate: Candidate = {
        id: candidateId, requisitionId, stageId: stage.id, name: entry.candidateName, email: entry.email, phone: entry.phone,
        source: "Inside software", appliedAt: new Date().toISOString(), rating: 0, hired: status.code === "HIRED", canceled: false,
      };
      return {
        stages,
        candidates: [candidate, ...s.candidates],
        talentPool: s.talentPool.map((t) =>
          t.id === entryId
            ? { ...t, takenToRecruitment: { requisitionId, candidateId, statusCode, at: new Date().toISOString() }, history: [{ id: rid(), event: "Moved to recruitment", detail: `${req.title} — ${status.label}`, at: new Date().toISOString() }, ...(t.history ?? [])] }
            : t,
        ),
      };
    });
    audit(`moved talent-pool applicant "${entry.candidateName}" to recruitment (${status.label})`, `hr/recruitment/${req.title}`);
    return { ok: true, candidateId };
  },
}));
