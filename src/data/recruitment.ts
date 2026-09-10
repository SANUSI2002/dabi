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

export type ApplicantDoc = { id: string; type: string; filename: string; sizeKb: number; dataUrl?: string; uploadedAt: string };
export type ApplicantEducation = { id: string; institution: string; qualification: string; field?: string; year?: string };
export type ApplicantExperience = { id: string; employer: string; role: string; from: string; to?: string; summary?: string };
export type ApplicantQualification = { id: string; name: string; body: string; obtained?: string; expires?: string; verified?: boolean };
export type ApplicantNote = { id: string; text: string; by: string; at: string };
export type ApplicantHistoryItem = { id: string; event: string; detail?: string; at: string };

export type TalentPoolEntry = {
  id: string;
  skillZone: string;
  candidateName: string;
  email: string;
  phone: string;
  reason: string;
  addedAt: string;
  fromCandidateId?: string;
  // rich profile (Phase 19)
  dob?: string;
  address?: string;
  headline?: string; // "Senior Midwife · 8 yrs"
  skills?: string[];
  education?: ApplicantEducation[];
  experience?: ApplicantExperience[];
  qualifications?: ApplicantQualification[];
  documents?: ApplicantDoc[];
  notes?: ApplicantNote[];
  history?: ApplicantHistoryItem[];
  takenToRecruitment?: { requisitionId: string; candidateId: string; statusCode: string; at: string };
};

export const SKILL_ZONES = ["Clinical — Nursing", "Clinical — Medical", "Laboratory", "Records & HMIS", "Administration", "Community Health"];

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

export const talentPool: TalentPoolEntry[] = [
  {
    id: "tp1", skillZone: "Clinical — Nursing", candidateName: "Grace Osei", email: "grace.osei@example.com", phone: "0803 222 3344",
    reason: "Strong midwifery background; no vacancy open when she applied", addedAt: day(40),
    dob: "1991-06-14", address: "24 Bode Thomas St, Surulere, Lagos", headline: "Senior Midwife · 8 years",
    skills: ["Midwifery", "Neonatal resuscitation", "IUCD insertion", "Antenatal counselling", "EmONC"],
    education: [
      { id: "ed1", institution: "University of Ibadan", qualification: "BNSc Nursing Science", field: "Nursing", year: "2013" },
      { id: "ed2", institution: "School of Midwifery, LUTH", qualification: "RM (Registered Midwife)", year: "2015" },
    ],
    experience: [
      { id: "ex1", employer: "Lagoon Hospitals", role: "Senior Staff Midwife", from: "2018", to: "2026", summary: "Labour ward lead, ~40 deliveries/month, precepted 6 student midwives." },
      { id: "ex2", employer: "Reddington Hospital", role: "Staff Nurse/Midwife", from: "2015", to: "2018" },
    ],
    qualifications: [
      { id: "q1", name: "NMCN Practising Licence", body: "Nursing & Midwifery Council of Nigeria", obtained: "2024-01-10", expires: "2027-01-09", verified: true },
      { id: "q2", name: "Basic Life Support (BLS)", body: "AHA", obtained: "2025-03-01", expires: "2027-03-01" },
    ],
    documents: [
      { id: "d1", type: "Curriculum Vitae", filename: "grace-osei-cv.pdf", sizeKb: 180, uploadedAt: day(40) },
      { id: "d2", type: "Degree Certificate", filename: "bnsc-certificate.pdf", sizeKb: 420, uploadedAt: day(40) },
      { id: "d3", type: "Professional Practising Licence", filename: "nmcn-licence-2024.pdf", sizeKb: 96, uploadedAt: day(40) },
    ],
    notes: [{ id: "n1", text: "Interviewed well for the Sept maternity role; lost out only on years-in-grade. Keep warm.", by: "s2", at: day(38) }],
    history: [
      { id: "h1", event: "Applied", detail: "Staff Nurse — Maternity Ward", at: day(45) },
      { id: "h2", event: "Interviewed", at: day(41) },
      { id: "h3", event: "Added to talent pool", detail: "Clinical — Nursing", at: day(40) },
    ],
  },
];

export const interviews: InterviewSchedule[] = [
  { id: "iv1", candidateId: "cd3", scheduledAt: day(-1), interviewerIds: ["s1", "s2"], notes: "Panel interview — clinical scenario + communication", status: "Scheduled" },
];
