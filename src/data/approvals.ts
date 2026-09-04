// Generic, configurable approval-workflow engine shared across the HR suite —
// Loan/Salary Advance approval, Disciplinary Query sign-off, Employee Conversion
// review, Offer Letter approval all submit into the same engine instead of each
// hard-coding its own approval chain. New approval types + workflows are
// authored from Settings (Workflow Builder), not from code.

export type ApproverType = "Line Manager" | "HR Administrator" | "Specific Person";

export type ApprovalStepDef = {
  id: string;
  order: number;
  name: string;
  approverType: ApproverType;
  approverId?: string; // staffId, only when approverType === "Specific Person"
};

export type ApprovalWorkflow = {
  id: string;
  name: string;
  steps: ApprovalStepDef[];
};

export type ApprovalType = {
  id: string;
  name: string;
  module: string; // "Onboarding" | "Payroll" | "Discipline" | "Recruitment" ...
  description: string;
  workflowId: string;
};

export type StepDecision = "Pending" | "Approved" | "Rejected";
export type ApprovalStepInstance = {
  stepId: string;
  name: string;
  approverType: ApproverType;
  approverId?: string; // resolved actual approver staffId
  decision: StepDecision;
  decidedAt?: string;
  comment?: string;
};

export type ApprovalRequestStatus = "Pending" | "Approved" | "Rejected";
export type ApprovalRequest = {
  id: string;
  approvalTypeId: string;
  workflowId: string;
  subjectLabel: string;
  requestedBy: string; // staffId
  requestedFor: string; // staffId this request concerns (usually === requestedBy)
  reference?: string; // e.g. onboarding progress id, loan id — lets a consumer look its own request up
  createdAt: string;
  decidedAt?: string;
  currentStepIndex: number;
  status: ApprovalRequestStatus;
  steps: ApprovalStepInstance[];
};

const day = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

export const workflows: ApprovalWorkflow[] = [
  {
    id: "wf1",
    name: "Line Manager → HR",
    steps: [
      { id: "wf1s1", order: 1, name: "Line Manager approval", approverType: "Line Manager" },
      { id: "wf1s2", order: 2, name: "HR sign-off", approverType: "HR Administrator" },
    ],
  },
  {
    id: "wf2",
    name: "HR only",
    steps: [{ id: "wf2s1", order: 1, name: "HR review", approverType: "HR Administrator" }],
  },
];

export const approvalTypes: ApprovalType[] = [
  { id: "at1", name: "Employee Conversion Review", module: "Onboarding", description: "Sign-off required before a candidate's onboarding record becomes a real employee.", workflowId: "wf2" },
  { id: "at2", name: "Loan / Salary Advance", module: "Payroll", description: "Requests above the auto-approve threshold route through the line manager, then HR.", workflowId: "wf1" },
  { id: "at3", name: "Disciplinary Query", module: "Discipline", description: "A query raised by a line manager is countersigned by HR before it is sent.", workflowId: "wf1" },
  { id: "at4", name: "Offer Letter", module: "Recruitment", description: "HR approval before an offer letter is generated and sent to a candidate.", workflowId: "wf2" },
];

export const requests: ApprovalRequest[] = [
  {
    id: "ar1",
    approvalTypeId: "at2",
    workflowId: "wf1",
    subjectLabel: "Salary advance — ₦50,000 (Stella Okon)",
    requestedBy: "s8",
    requestedFor: "s8",
    reference: "ln1",
    createdAt: day(40),
    currentStepIndex: 1,
    status: "Pending",
    steps: [
      { stepId: "wf1s1", name: "Line Manager approval", approverType: "Line Manager", approverId: "s2", decision: "Approved", decidedAt: day(39), comment: "Approved — first request this year." },
      { stepId: "wf1s2", name: "HR sign-off", approverType: "HR Administrator", approverId: "s1", decision: "Pending" },
    ],
  },
];
