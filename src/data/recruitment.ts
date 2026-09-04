// Recruitment (ATS) — job requisition → Kanban pipeline stages → candidates → hire.

const day = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

export type StageType = "Initial" | "Applied" | "Test" | "Interview" | "Hired" | "Cancelled";

export type JobRequisition = {
  id: string;
  title: string;
  description: string;
  departmentId: string;
  jobPositionId: string;
  vacancy: number;
  managerIds: string[]; // staff ids
  startDate: string;
  endDate?: string;
  closed: boolean;
};

export type PipelineStage = {
  id: string;
  requisitionId: string;
  name: string;
  type: StageType;
  sequence: number;
};

export type CandidateSource = "Application" | "Referral" | "Inside software";

export type Candidate = {
  id: string;
  requisitionId: string;
  stageId: string;
  name: string;
  email: string;
  phone: string;
  source: CandidateSource;
  referredBy?: string; // staff id
  appliedAt: string;
  rating: number; // 0-5
  hired: boolean;
  canceled: boolean;
  cancelReason?: string;
  convertedEmployeeId?: string;
};

export type InterviewStatus = "Scheduled" | "Completed" | "Cancelled";
export type InterviewSchedule = {
  id: string;
  candidateId: string;
  scheduledAt: string;
  interviewerIds: string[];
  notes?: string;
  status: InterviewStatus;
  feedback?: string;
};

export const REJECT_REASONS = [
  "Overqualified", "Underqualified", "Failed practical test", "Salary mismatch",
  "Did not attend interview", "Position filled internally", "Other",
];

export const requisitions: JobRequisition[] = [
  { id: "req1", title: "Staff Nurse — Maternity Ward", description: "Cover the maternity ward night rotation; RN/RM required.", departmentId: "d1", jobPositionId: "jp1", vacancy: 2, managerIds: ["s2"], startDate: day(20), closed: false },
  { id: "req2", title: "Lab Technician (Locum cover)", description: "3-month locum cover while the substantive Lab Tech is on study leave.", departmentId: "d3", jobPositionId: "jp3", vacancy: 1, managerIds: ["s1"], startDate: day(35), closed: false },
];

function defaultStages(requisitionId: string): PipelineStage[] {
  const names: [string, StageType][] = [["Applied", "Applied"], ["Screening", "Test"], ["Interview", "Interview"], ["Hired", "Hired"]];
  return names.map(([name, type], i) => ({ id: `${requisitionId}-st${i}`, requisitionId, name, type, sequence: i }));
}

export const stages: PipelineStage[] = [...defaultStages("req1"), ...defaultStages("req2")];

export const candidates: Candidate[] = [
  { id: "cd1", requisitionId: "req1", stageId: "req1-st0", name: "Chiamaka Eze", email: "chiamaka.eze@example.com", phone: "0803 444 5566", source: "Application", appliedAt: day(15), rating: 0, hired: false, canceled: false },
  { id: "cd2", requisitionId: "req1", stageId: "req1-st1", name: "Blessing Achor", email: "blessing.achor@example.com", phone: "0805 555 6677", source: "Referral", referredBy: "s2", appliedAt: day(18), rating: 3, hired: false, canceled: false },
  { id: "cd3", requisitionId: "req1", stageId: "req1-st2", name: "Ngozi Umeh", email: "ngozi.umeh@example.com", phone: "0806 666 7788", source: "Application", appliedAt: day(19), rating: 4, hired: false, canceled: false },
  { id: "cd4", requisitionId: "req2", stageId: "req2-st0", name: "Tunde Bakare", email: "tunde.bakare@example.com", phone: "0807 777 8899", source: "Application", appliedAt: day(9), rating: 0, hired: false, canceled: false },
];

export const interviews: InterviewSchedule[] = [
  { id: "iv1", candidateId: "cd3", scheduledAt: day(-1), interviewerIds: ["s1", "s2"], notes: "Panel interview — clinical scenario + communication", status: "Scheduled" },
];
