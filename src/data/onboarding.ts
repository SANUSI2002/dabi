// New-hire onboarding — a standard checklist walked stage by stage; completing the
// final stage converts the candidate into a real employee (useHr + useEmployees).

export type OnboardingStage = {
  id: string;
  title: string;
  sequence: number;
  isFinal: boolean;
};

export type OnboardingTask = {
  id: string;
  stageId: string;
  title: string;
  isRequired: boolean;
  requiresUpload?: boolean;
};

export type OnboardingDocument = {
  id: string;
  progressId: string;
  taskId: string;
  title: string;
  uploadedAt: string;
};

export type OnboardingProgress = {
  id: string;
  candidateId: string;
  candidateName: string;
  requisitionId: string;
  jobPositionId: string;
  departmentId: string;
  currentStageId: string;
  taskDone: Record<string, boolean>;
  startedAt: string;
  completedAt?: string;
  employeeId?: string; // set once converted
  resumptionDate?: string;
  basicSalary?: number;
};

export const stages: OnboardingStage[] = [
  { id: "ob-st0", title: "Documentation", sequence: 0, isFinal: false },
  { id: "ob-st1", title: "Compliance & Training", sequence: 1, isFinal: false },
  { id: "ob-st2", title: "Systems & Access", sequence: 2, isFinal: false },
  { id: "ob-st3", title: "Final Sign-off", sequence: 3, isFinal: true },
];

export const tasks: OnboardingTask[] = [
  { id: "ob-t0", stageId: "ob-st0", title: "ID verification (NIN/passport)", isRequired: true, requiresUpload: true },
  { id: "ob-t1", stageId: "ob-st0", title: "Signed offer letter on file", isRequired: true, requiresUpload: true },
  { id: "ob-t2", stageId: "ob-st0", title: "Bank details submitted", isRequired: true },
  { id: "ob-t3", stageId: "ob-st1", title: "NDPR / patient-confidentiality agreement signed", isRequired: true },
  { id: "ob-t4", stageId: "ob-st1", title: "Infection prevention & control orientation", isRequired: true },
  { id: "ob-t5", stageId: "ob-st1", title: "BLS / CPR briefing", isRequired: false },
  { id: "ob-t6", stageId: "ob-st2", title: "EMR account provisioned", isRequired: true },
  { id: "ob-t7", stageId: "ob-st2", title: "Uniform & ID badge issued", isRequired: false },
  { id: "ob-t8", stageId: "ob-st3", title: "Probation terms briefed (90 days)", isRequired: true },
  { id: "ob-t9", stageId: "ob-st3", title: "Introduced to reporting manager & team", isRequired: true },
];

export const defaultOfferLetterTemplate = `Sabi Health Post
{{company_address}}

{{date}}

Dear {{candidate_name}},

OFFER OF EMPLOYMENT — {{job_position}}

We are pleased to offer you the position of {{job_position}} in the {{department}} department of Sabi Health Post, reporting to {{reporting_manager}}.

Basic salary: {{basic_salary}} per annum, paid monthly, subject to statutory deductions.
Resumption date: {{resumption_date}}
Probation period: 90 days from resumption.

Please sign and return a copy of this letter to confirm your acceptance.

Yours sincerely,
Human Resources
Sabi Health Post`;
