import { create } from "zustand";
import { useRecruitment } from "@/store/useRecruitment";
import { useOnboarding } from "@/store/useOnboarding";
import { useOffboarding } from "@/store/useOffboarding";
import { useVacancies } from "@/store/useVacancies";
import { useLiveEmr } from "@/emr-live/session";
import { useMasterData } from "@/platform/useMasterData";
import { workforceRequest } from "@/emr-live/client";
import type { Candidate, InterviewSchedule, JobRequisition, PipelineStage, StageType, TalentPoolEntry } from "@/data/recruitment";
import type { OnboardingDocument, OnboardingProgress } from "@/data/onboarding";
import type { OffboardingCase } from "@/data/offboarding";
import type { VacancyRequest } from "@/data/vacancies";
import { adoptLiveIdentity, clean, isoDay, liveChange, uuid } from "./sync";
import { loadPeople } from "./people";
import { followWorkflows, loadWorkflows } from "./workflows";

// Hiring and exits in live mode (GET /hiring): Recruitment, Talent Pool, Vacancy Requests, Onboarding
// and Offboarding read and write the organization's records. Vacancy approval and onboarding sign-off
// run through the organization's approval workflows (decided in the Approvals inbox); the server sets
// a vacancy's status from the outcome, so the screens never decide it themselves.

type Versioned = { version: number };
type ApiHiring = {
  selfEmployeeId: string | null; canManage: boolean; ledDepartmentIds: string[];
  vacancies: (VacancyRequest & Versioned)[]; requisitions: JobRequisition[]; stages: PipelineStage[]; candidates: Candidate[]; interviews: InterviewSchedule[];
  talentPool: TalentPoolEntry[]; onboarding: (OnboardingProgress & Versioned)[]; onboardingDocuments: OnboardingDocument[];
  offerLetterTemplate: { text: string; version: number } | null; offboarding: OffboardingCase[];
};

export const useLiveHiringMeta = create<{ loaded: boolean; offerTemplateVersion: number }>(() => ({ loaded: false, offerTemplateVersion: 0 }));

const noNull = <T extends object>(row: T) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null)) as T;

export async function loadHiring() {
  const { data } = await workforceRequest<{ data: ApiHiring }>("/hiring");
  useLiveHiringMeta.setState({ loaded: true, offerTemplateVersion: data.offerLetterTemplate?.version ?? 0 });
  useVacancies.setState({ vacancies: data.vacancies.map((v) => noNull(v)) });
  useRecruitment.setState({ requisitions: data.requisitions.map((r) => noNull(r)), stages: data.stages, candidates: data.candidates.map((c) => noNull(c)), interviews: data.interviews.map((i) => noNull(i)), talentPool: data.talentPool.map((t) => noNull(t)) });
  useOnboarding.setState({ progress: data.onboarding.map((p) => noNull(p)), documents: data.onboardingDocuments, ...(data.offerLetterTemplate ? { offerLetterTemplate: data.offerLetterTemplate.text } : {}) });
  useOffboarding.setState({ cases: data.offboarding.map((c) => noNull(c)) });
  adoptLiveIdentity(data.selfEmployeeId);
}

const hr = () => useLiveEmr.getState().access?.permissions.includes("hr.read") ?? false;
const reload = () => loadHiring();
/** After a change that also moves people (a new employee, a deactivation) or a workflow. */
const reloadWith = (...more: (() => Promise<void>)[]) => async () => { await Promise.all([loadHiring(), ...more.map((load) => load())]); };
const post = (path: string, body: unknown = {}) => workforceRequest(path, { method: "POST", body });
const patch = (path: string, body: unknown, version?: number) => workforceRequest(path, { method: "PATCH", body, ...(version !== undefined ? { version } : {}) });
const rec = () => useRecruitment.getState();
const versionOf = (list: { id: string; version?: number }[], id: string) => {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error("This record is no longer in the list; refresh and try again.");
  return found.version ?? 1;
};

// Typing a salary sends one change after a pause, not one per keystroke.
const salaryTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function goLiveHiring() {
  followWorkflows(() => (useLiveHiringMeta.getState().loaded ? loadHiring() : Promise.resolve()));
  useRecruitment.setState({
    addRequisition: (r) => {
      const id = uuid();
      void liveChange(() => post("/hiring/requisitions", clean({ id, title: r.title, description: r.description, departmentId: r.departmentId || undefined, jobPositionId: r.jobPositionId || undefined, vacancy: r.vacancy, startDate: isoDay(r.startDate), endDate: isoDay(r.endDate), managerIds: r.managerIds })), reload,
        () => useRecruitment.setState((s) => ({ requisitions: [{ ...r, id, closed: false }, ...s.requisitions] })));
    },
    closeRequisition: (id) => { void liveChange(() => post(`/hiring/requisitions/${id}/close`), reload); },
    addCandidate: (c) => {
      const id = uuid();
      void liveChange(() => post("/hiring/candidates", clean({ id, requisitionId: c.requisitionId, name: c.name, email: c.email, phone: c.phone || undefined, source: c.source, referredBy: c.referredBy })), reload);
    },
    moveCandidate: (candidateId, stageId) => {
      void liveChange(() => post(`/hiring/candidates/${candidateId}/move`, { stageId }), reload, () => useRecruitment.setState((s) => ({ candidates: s.candidates.map((c) => (c.id === candidateId ? { ...c, stageId } : c)) })));
    },
    rateCandidate: (candidateId, rating) => {
      void liveChange(() => post(`/hiring/candidates/${candidateId}/rate`, { rating }), reload, () => useRecruitment.setState((s) => ({ candidates: s.candidates.map((c) => (c.id === candidateId ? { ...c, rating } : c)) })));
    },
    rejectCandidate: (candidateId, reason) => { void liveChange(() => post(`/hiring/candidates/${candidateId}/reject`, { reason }), reload); },
    hireCandidate: (candidateId) => { void liveChange(() => post(`/hiring/candidates/${candidateId}/hire`), reload); },
    scheduleInterview: (i) => { void liveChange(() => post("/hiring/interviews", clean({ id: uuid(), candidateId: i.candidateId, scheduledAt: i.scheduledAt, interviewerIds: i.interviewerIds, notes: i.notes })), reload); },
    completeInterview: (id, feedback) => { void liveChange(() => post(`/hiring/interviews/${id}/complete`, { feedback }), reload); },
    addToTalentPool: (candidateId, skillZone, reason) => { void liveChange(() => post("/hiring/talent-pool", { id: uuid(), candidateId, skillZone, reason }), reload); },
    addTalentNote: (entryId, text) => { void liveChange(() => post(`/hiring/talent-pool/${entryId}/notes`, { text }), reload); },
    addTalentDocument: (entryId, doc) => { void liveChange(() => post(`/hiring/talent-pool/${entryId}/documents`, clean({ type: doc.type, filename: doc.filename, sizeKb: doc.sizeKb })), reload); },
    takeToRecruitment: (entryId, requisitionId, statusCode) => {
      const entry = rec().talentEntryById(entryId);
      if (!entry || !rec().requisitions.some((r) => r.id === requisitionId)) return { ok: false, error: "Applicant or requisition not found." };
      const status = useMasterData.getState().byCode("recruitment-statuses", statusCode);
      if (!status) return { ok: false, error: "Unknown recruitment status." };
      // The same mapping as the screens: a terminal status is Hired / Cancelled, Interview stays Interview, the rest are tests.
      const stageType: StageType = status.meta?.terminal ? (status.code === "HIRED" ? "Hired" : "Cancelled") : status.code === "INTERVIEW" ? "Interview" : "Test";
      const candidateId = uuid();
      void liveChange(() => post(`/hiring/talent-pool/${entryId}/take-to-recruitment`, { requisitionId, statusCode, statusLabel: status.label, stageType, candidateId }), reload);
      return { ok: true, candidateId };
    },
  });

  useOnboarding.setState({
    startOnboarding: (input) => {
      if (useOnboarding.getState().progress.some((p) => p.candidateId === input.candidateId)) return;
      void liveChange(() => post("/hiring/onboarding", { id: uuid(), candidateId: input.candidateId }), reload);
    },
    toggleTask: (progressId, taskId) => {
      void liveChange(() => post(`/hiring/onboarding/${progressId}/tasks`, { taskId }), reload,
        () => useOnboarding.setState((s) => ({ progress: s.progress.map((p) => (p.id === progressId ? { ...p, taskDone: { ...p.taskDone, [taskId]: !p.taskDone[taskId] } } : p)) })));
    },
    uploadTaskDocument: (progressId, taskId, title) => { void liveChange(() => post(`/hiring/onboarding/${progressId}/documents`, { taskId, title }), reload); },
    setResumptionDate: (progressId, date) => {
      if (!date) return;
      void liveChange(() => patch(`/hiring/onboarding/${progressId}`, { resumptionDate: isoDay(date) }), reload,
        () => useOnboarding.setState((s) => ({ progress: s.progress.map((p) => (p.id === progressId ? { ...p, resumptionDate: date } : p)) })));
    },
    setBasicSalary: (progressId, amount) => {
      useOnboarding.setState((s) => ({ progress: s.progress.map((p) => (p.id === progressId ? { ...p, basicSalary: amount } : p)) }));
      clearTimeout(salaryTimers.get(progressId));
      if (!(amount > 0)) return;
      salaryTimers.set(progressId, setTimeout(() => { void liveChange(() => patch(`/hiring/onboarding/${progressId}`, { basicSalary: amount }), reload); }, 600));
    },
    setOfferLetterTemplate: (text) => {
      void liveChange(() => workforceRequest("/hiring/offer-letter-template", { method: "PUT", version: useLiveHiringMeta.getState().offerTemplateVersion, body: { text } }), reload, () => useOnboarding.setState({ offerLetterTemplate: text }));
    },
    advanceStage: (progressId) => { void liveChange(() => post(`/hiring/onboarding/${progressId}/advance`), reload); },
    convertToEmployee: (progressId, role, cadre) => {
      const p = useOnboarding.getState().progress.find((x) => x.id === progressId);
      if (!p || p.employeeId) return p?.employeeId;
      const employeeId = uuid();
      void liveChange(() => post(`/hiring/onboarding/${progressId}/convert`, clean({ employeeId, role, cadre: cadre || undefined })), reloadWith(...(hr() ? [loadPeople] : [])));
      return employeeId;
    },
  });

  useOffboarding.setState({
    initiate: (employeeId, reason, lastWorkingDate) => {
      if (useOffboarding.getState().cases.some((c) => c.employeeId === employeeId && c.status === "Ongoing")) return;
      void liveChange(() => post("/hiring/offboarding", { id: uuid(), employeeId, reason, lastWorkingDate: isoDay(lastWorkingDate) }), reload);
    },
    recordExitInterview: (caseId, notes) => { void liveChange(() => patch(`/hiring/offboarding/${caseId}`, { exitInterviewNotes: notes }), reload); },
    recordHandover: (caseId, notes) => { void liveChange(() => patch(`/hiring/offboarding/${caseId}`, { handoverNotes: notes }), reload); },
    settleFnf: (caseId, amount) => { void liveChange(() => patch(`/hiring/offboarding/${caseId}`, { fnfAmount: amount }), reload); },
    advanceStage: (caseId) => { void liveChange(() => post(`/hiring/offboarding/${caseId}/advance`), reloadWith(...(hr() ? [loadPeople] : []))); },
  });

  useVacancies.setState({
    createVacancy: (input) => {
      const id = uuid();
      void liveChange(() => post("/hiring/vacancies", clean({ id, ...input })), reload);
      return id;
    },
    updateVacancy: (id, change) => {
      void liveChange(() => patch(`/hiring/vacancies/${id}`, clean(change as Record<string, unknown>), versionOf(useVacancies.getState().vacancies as (VacancyRequest & Partial<Versioned>)[], id)), reload);
    },
    submitVacancy: (id) => {
      void liveChange(() => post("/workflows/instances", { triggerType: "vacancy", reference: id }), reloadWith(loadWorkflows));
      return { ok: true };
    },
    cancelVacancy: (id) => { void liveChange(() => post(`/hiring/vacancies/${id}/cancel`), reloadWith(loadWorkflows)); },
    // The server records the workflow's outcome on the vacancy; nothing to sync here.
    syncFromWorkflow: () => undefined,
    markFilled: (id) => { void liveChange(() => post(`/hiring/vacancies/${id}/filled`), reload); },
    liveStatus: (v) => v.status,
  });
}

export function clearHiring() {
  useLiveHiringMeta.setState({ loaded: false, offerTemplateVersion: 0 });
  useVacancies.setState({ vacancies: [] });
  useRecruitment.setState({ requisitions: [], stages: [], candidates: [], interviews: [], talentPool: [] });
  useOnboarding.setState({ progress: [], documents: [] });
  useOffboarding.setState({ cases: [] });
}
