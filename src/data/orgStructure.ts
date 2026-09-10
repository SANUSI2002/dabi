// Org structure — company/facility, department, job position, job role, employee type, tags.
// This is the shared foundation the whole HR suite sits on (mirrors Horilla's base app),
// and is deliberately separate from clinical FACILITY (src/data/mock.ts) so a multi-facility
// / multi-company deployment is possible later without touching EMR code.

export type Company = {
  id: string;
  name: string;
  code: string;
  isHeadquarters: boolean;
  address: string;
  lga: string;
  state: string;
  country: string;
};

export type DepartmentStatus = "Active" | "Inactive" | "Merging" | "Dissolved";

export type Department = {
  id: string;
  name: string;
  code: string;
  description?: string;
  companyIds: string[]; // branches this department operates in
  status: DepartmentStatus;
  hodId?: string; // staff id
  deputyHodId?: string;
  staffIds: string[]; // explicitly assigned members (beyond position-based)
  parentDepartmentId?: string; // sub-departments / units
  createdAt: string;
};

/** an immutable record every time a department's leadership changes */
export type HodChange = {
  id: string;
  departmentId: string;
  role: "hod" | "deputy-hod";
  previousStaffId?: string;
  newStaffId?: string;
  effectiveDate: string;
  reason?: string;
  changedBy: string;
  at: string;
};

export type JobPosition = {
  id: string;
  name: string;
  departmentId: string;
};

export type JobRole = {
  id: string;
  name: string;
  jobPositionId: string;
};

export type EmployeeType = {
  id: string;
  name: string; // Permanent, Contract, Locum, NYSC, Volunteer
};

export type OrgTag = {
  id: string;
  name: string;
  color: string;
};

export const companies: Company[] = [
  { id: "co1", name: "Sabi Health Post", code: "PHC-SABI-014", isHeadquarters: true, address: "12 Kirikiri Road", lga: "Amuwo-Odofin", state: "Lagos", country: "Nigeria" },
];

const d = (id: string, name: string, code: string, hodId: string | undefined, deputyHodId: string | undefined, staffIds: string[], description: string): Department => ({
  id, name, code, description, companyIds: ["co1"], status: "Active", hodId, deputyHodId, staffIds, createdAt: "2025-01-01T00:00:00.000Z",
});

export const departments: Department[] = [
  d("d1", "Nursing", "NUR", "s2", "s3", ["s2", "s3", "s5", "s8"], "Ward and clinic nursing across all service points."),
  d("d2", "Medical", "MED", "s1", undefined, ["s1"], "Medical officers, consultations, admissions."),
  d("d3", "Laboratory", "LAB", "s7", undefined, ["s7"], "Diagnostic testing, sample workflow and results."),
  d("d4", "Pharmacy", "PHM", undefined, undefined, [], "Dispensing and drug inventory."),
  d("d5", "Records & HMIS", "REC", "s6", undefined, ["s4", "s6"], "Health records, M&E and statutory reporting."),
  d("d6", "Administration", "ADM", "s1", undefined, [], "HR, front office, facilities and finance liaison."),
  d("d7", "Community Health", "CHW", undefined, undefined, [], "Outreach, CHW programmes and referrals."),
];

export const hodChanges: HodChange[] = [];

export const jobPositions: JobPosition[] = [
  { id: "jp1", name: "Nurse", departmentId: "d1" },
  { id: "jp2", name: "Medical Officer", departmentId: "d2" },
  { id: "jp3", name: "Lab Technician", departmentId: "d3" },
  { id: "jp4", name: "Pharmacy Technician", departmentId: "d4" },
  { id: "jp5", name: "Health Records Officer", departmentId: "d5" },
  { id: "jp6", name: "M&E / HMIS Officer", departmentId: "d5" },
  { id: "jp7", name: "Receptionist", departmentId: "d6" },
  { id: "jp8", name: "HR / Admin Officer", departmentId: "d6" },
  { id: "jp9", name: "Community Health Worker", departmentId: "d7" },
];

export const jobRoles: JobRole[] = [
  { id: "jr1", name: "Senior Nurse", jobPositionId: "jp1" },
  { id: "jr2", name: "Staff Nurse", jobPositionId: "jp1" },
  { id: "jr3", name: "Medical Officer of Health", jobPositionId: "jp2" },
  { id: "jr4", name: "Lab Scientist", jobPositionId: "jp3" },
];

export const employeeTypes: EmployeeType[] = [
  { id: "et1", name: "Permanent" },
  { id: "et2", name: "Contract" },
  { id: "et3", name: "Locum" },
  { id: "et4", name: "NYSC / Corps Member" },
  { id: "et5", name: "Volunteer" },
];

export const orgTags: OrgTag[] = [
  { id: "tg1", name: "Night shift lead", color: "#0fc06d" },
  { id: "tg2", name: "First aid certified", color: "#3b82f6" },
  { id: "tg3", name: "Flight risk", color: "#f83b3b" },
  { id: "tg4", name: "High performer", color: "#f59e0b" },
];
