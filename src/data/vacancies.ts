// Vacancy requests (Phase 18). An HOD raises a request for their department; it
// runs through the configurable "vacancy" workflow (HR approval, with a 48h
// escalation by default). On rejection HR gives a reason and the HOD can revise
// and resubmit. On approval it can spawn a recruitment requisition.

export type VacancyStatus = "Draft" | "Submitted" | "Approved" | "Rejected" | "Filled" | "Cancelled";

export type VacancyRequest = {
  id: string;
  departmentId: string;
  jobPositionId?: string;
  roleTitle: string;
  headcount: number;
  vacancyTypeId?: string; // master-data "vacancy-types"
  reason: string;
  requirements?: string;
  salaryMin?: number;
  salaryMax?: number;
  raisedBy: string; // staff id
  status: VacancyStatus;
  workflowRef?: string; // = this vacancy's id, used as the workflow instance reference
  rejectionReason?: string;
  requisitionId?: string; // recruitment requisition created on approval
  createdAt: string;
  submittedAt?: string;
  decidedAt?: string;
};

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

export const seedVacancies: VacancyRequest[] = [
  {
    id: "vac-1",
    departmentId: "d3",
    roleTitle: "Medical Laboratory Scientist",
    headcount: 1,
    reason: "Rising sample volume from the new NHIS enrollees; current single scientist can't cover the extended hours.",
    requirements: "BMLS + MLSCN licence; 2+ years bench experience; chemistry & haematology.",
    salaryMin: 280_000,
    salaryMax: 360_000,
    raisedBy: "s7",
    status: "Submitted",
    workflowRef: "vac-1",
    createdAt: daysAgo(2),
    submittedAt: daysAgo(2),
  },
];
