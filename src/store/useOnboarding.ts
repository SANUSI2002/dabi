import { create } from "zustand";
import * as seed from "@/data/onboarding";
import { audit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import { useEmployees } from "@/store/useEmployees";
import { usePayroll } from "@/store/usePayroll";
import { useOrg } from "@/store/useOrg";
import { useLetters } from "@/platform/useLetters";
import { useIdentity } from "@/store/useIdentity";
import { term } from "@/platform/useTerminology";
import type { OnboardingProgress, OnboardingDocument } from "@/data/onboarding";

const rid = () => Math.random().toString(36).slice(2, 9);

type OnboardingState = {
  stages: typeof seed.stages;
  tasks: typeof seed.tasks;
  progress: OnboardingProgress[];
  documents: OnboardingDocument[];
  offerLetterTemplate: string;

  startOnboarding: (input: { candidateId: string; candidateName: string; requisitionId: string; jobPositionId: string; departmentId: string }) => void;
  toggleTask: (progressId: string, taskId: string) => void;
  uploadTaskDocument: (progressId: string, taskId: string, title: string) => void;
  documentsFor: (progressId: string) => OnboardingDocument[];
  outstandingRequiredDocs: (progressId: string) => string[];
  raiseMissingDocumentLetter: (progressId: string, opts?: { deadline?: string }) => string | undefined;
  setResumptionDate: (progressId: string, date: string) => void;
  setBasicSalary: (progressId: string, amount: number) => void;
  setOfferLetterTemplate: (text: string) => void;
  canAdvance: (progressId: string) => boolean;
  advanceStage: (progressId: string) => void;
  convertToEmployee: (progressId: string, role: string, cadre: string) => string | undefined;
};

export const useOnboarding = create<OnboardingState>((set, get) => ({
  stages: seed.stages,
  tasks: seed.tasks,
  progress: [],
  documents: [],
  offerLetterTemplate: seed.defaultOfferLetterTemplate,

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

  uploadTaskDocument: (progressId, taskId, title) => {
    const task = get().tasks.find((t) => t.id === taskId);
    const p = get().progress.find((x) => x.id === progressId);
    audit("uploaded onboarding document", `hr/onboarding/${p?.candidateName ?? progressId}/${task?.title ?? taskId}`);
    set((s) => ({
      documents: [{ id: rid(), progressId, taskId, title, uploadedAt: new Date().toISOString() }, ...s.documents],
      progress: s.progress.map((x) => (x.id === progressId ? { ...x, taskDone: { ...x.taskDone, [taskId]: true } } : x)),
    }));
  },

  documentsFor: (progressId) => get().documents.filter((d) => d.progressId === progressId),

  outstandingRequiredDocs: (progressId) => {
    const p = get().progress.find((x) => x.id === progressId);
    if (!p) return [];
    return get().tasks
      .filter((t) => t.requiresUpload && t.isRequired && !p.taskDone[t.id])
      .map((t) => t.title);
  },

  raiseMissingDocumentLetter: (progressId, opts) => {
    const p = get().progress.find((x) => x.id === progressId);
    if (!p) return undefined;
    const missing = get().outstandingRequiredDocs(progressId);
    if (missing.length === 0) return undefined;
    const issuer = useIdentity.getState().user;
    const id = useLetters.getState().generate({
      templateKey: "missing-document",
      title: `Outstanding Document Notice — ${p.candidateName}`,
      reference: p.id,
      data: {
        employee_name: p.candidateName,
        document_list: missing.map((m) => `• ${m}`).join("\n"),
        department: useOrg.getState().departmentName(p.departmentId),
        deadline: opts?.deadline ?? "________",
        issued_by: issuer.name,
        issuer_role: term("hod", "singular"),
        organisation: term("organisation", "singular"),
      },
    });
    audit("generated outstanding-document notice", `hr/onboarding/${p.candidateName}`);
    return id;
  },

  setResumptionDate: (progressId, date) => {
    set((s) => ({ progress: s.progress.map((x) => (x.id === progressId ? { ...x, resumptionDate: date } : x)) }));
  },

  setBasicSalary: (progressId, amount) => {
    set((s) => ({ progress: s.progress.map((x) => (x.id === progressId ? { ...x, basicSalary: amount } : x)) }));
  },

  setOfferLetterTemplate: (text) => {
    audit("updated offer letter template", "hr/onboarding/offer-letter-template");
    set({ offerLetterTemplate: text });
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
      if (p.basicSalary) {
        usePayroll.getState().setStructure(created.id, p.basicSalary, [], []);
      }
      get().documentsFor(progressId).forEach((d) => {
        useEmployees.getState().requestDocument([created.id], d.title, "Other");
        const doc = useEmployees.getState().documents.find((x) => x.employeeId === created.id && x.title === d.title);
        if (doc) {
          useEmployees.getState().uploadDocument(doc.id, { issueDate: d.uploadedAt });
          useEmployees.getState().reviewDocument(doc.id, "Approved");
        }
      });
    }
    set((s) => ({ progress: s.progress.map((x) => (x.id === progressId ? { ...x, employeeId: created?.id } : x)) }));
    return created?.id;
  },
}));
